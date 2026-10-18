// The assignment action layer (US8). Only a GM assigns or transfers; the rules
// are enforced here on the server, not in the UI.
import { requireDealAccess, requireGm, requireUuid, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { CLOSED_STAGES, assignmentBody, parseReason } from './policy.ts';
import * as repo from './repository.ts';

export interface ChangeInput {
  toUserId: unknown;
  reason: unknown;
  // The owner the GM saw (null for unassigned). If someone changed the owner
  // since, the request is refused rather than silently moving the deal again.
  expectedOwnerId?: unknown;
}

function parseExpectedOwner(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw badRequest('expectedOwnerId must be a UUID or null.');
  return requireUuid(value, 'expectedOwnerId');
}

async function change(db: Database, gm: Staff, dealId: string, input: ChangeInput,
  kind: repo.AssignmentKind) {
  requireGm(gm, kind === 'assignment' ? 'assign a buyer' : 'transfer a buyer');
  if (typeof input.toUserId !== 'string') throw badRequest('toUserId is required.');
  const toUserId = requireUuid(input.toUserId, 'toUserId');
  const reason = parseReason(input.reason);
  const expectedOwnerId = parseExpectedOwner(input.expectedOwnerId);

  return db.transaction(async (tx) => {
    const deal = await repo.lockDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
    if (expectedOwnerId !== undefined && expectedOwnerId !== deal.ownerId) {
      throw conflict(deal.ownerId === null
        ? 'This deal has been unassigned since you opened it. Reload and try again.'
        : `This deal now belongs to ${deal.owner}. Reload and try again.`);
    }
    if ((CLOSED_STAGES as readonly string[]).includes(deal.stage)) {
      throw conflict(`A ${deal.stage} deal is closed and cannot be reassigned.`);
    }
    if (kind === 'assignment' && deal.ownerId !== null) {
      throw conflict(`This deal is already assigned to ${deal.owner}. Use transfer instead.`);
    }
    if (kind === 'transfer' && deal.ownerId === null) {
      throw conflict('This deal is unassigned. Use assign instead.');
    }

    const target = await repo.findStaff(tx, toUserId);
    if (!target) throw notFound('Target staff member not found.');
    if (target.role !== 'rep') throw badRequest('Deals can only be assigned to a rep.');
    if (target.id === deal.ownerId) throw conflict(`This deal already belongs to ${target.name}.`);

    await repo.setOwner(tx, dealId, target.id, kind === 'assignment');
    const openItemsMoved = await repo.moveOpenItems(tx, dealId, target.id);
    const event = await repo.addAssignmentEvent(tx, dealId, gm, kind,
      assignmentBody(deal.buyer, deal.owner, target.name, reason));
    await repo.addAssignmentRecord(tx, {
      dealId, kind, fromOwnerId: deal.ownerId, toOwnerId: target.id, assignedBy: gm.id,
      reason, openItemsMoved, eventId: event.id, at: event.createdAt,
    });
    return {
      dealId,
      buyer: deal.buyer,
      kind,
      at: event.createdAt,
      by: { id: gm.id, name: gm.name },
      from: deal.ownerId === null ? null : { id: deal.ownerId, name: deal.owner ?? '' },
      to: { id: target.id, name: target.name },
      reason,
      openItemsMoved,
      eventId: event.id,
    };
  });
}

export const assignDeal = (db: Database, gm: Staff, dealId: string, input: ChangeInput) =>
  change(db, gm, dealId, input, 'assignment');

export const transferDeal = (db: Database, gm: Staff, dealId: string, input: ChangeInput) =>
  change(db, gm, dealId, input, 'transfer');

// The GM sees every deal's history; a rep sees it for their own deals.
export async function dealAssignments(db: Database, staff: Staff, dealId: string) {
  const deal = await repo.findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  return {
    dealId,
    buyer: deal.buyer,
    currentOwner: deal.ownerId === null ? null : { id: deal.ownerId, name: deal.owner },
    history: await repo.assignmentHistory(db, dealId),
  };
}

export async function unassignedDeals(db: Database, staff: Staff) {
  requireGm(staff, 'see unassigned buyers');
  return repo.unassignedDeals(db);
}

// Who a GM can assign or transfer to.
export async function assignableReps(db: Database, staff: Staff) {
  requireGm(staff, 'list reps for assignment');
  return repo.reps(db);
}
