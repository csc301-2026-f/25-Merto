// The assignment action layer (US8). Only a GM assigns or transfers; the rules
// are enforced here on the server, not in the UI.
import { requireDealAccess, requireGm, requireUuid, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { CLOSED_STAGES, assignmentBody, parseReason } from './policy.ts';
import * as repo from './repository.ts';

async function change(db: Database, gm: Staff, dealId: string, toUserId: unknown,
  reasonInput: unknown, kind: 'assignment' | 'transfer') {
  requireGm(gm, kind === 'assignment' ? 'assign a buyer' : 'transfer a buyer');
  if (typeof toUserId !== 'string') throw badRequest('toUserId is required.');
  requireUuid(toUserId, 'toUserId');
  const reason = parseReason(reasonInput);

  return db.transaction(async (tx) => {
    const deal = await repo.lockDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
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
    const event = await repo.addAssignmentEvent(tx, dealId, gm.id, kind,
      assignmentBody(deal.buyer, deal.owner, target.name, reason));
    return {
      dealId,
      buyer: deal.buyer,
      from: deal.ownerId === null ? null : { id: deal.ownerId, name: deal.owner },
      to: { id: target.id, name: target.name },
      reason,
      openItemsMoved,
      event,
    };
  });
}

export const assignDeal = (db: Database, gm: Staff, dealId: string, toUserId: unknown, reason: unknown) =>
  change(db, gm, dealId, toUserId, reason, 'assignment');

export const transferDeal = (db: Database, gm: Staff, dealId: string, toUserId: unknown, reason: unknown) =>
  change(db, gm, dealId, toUserId, reason, 'transfer');

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
