// Deals and the buyer record. A rep sees their own deals; the GM sees every
// deal in the store (US10). Checked here, not in the UI.
import { requireDealAccess, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { conflict, notFound } from '../errors.ts';
import { addAssignmentEvent, addAssignmentRecord, assignmentHistory } from '../assignment/repository.ts';
import { parseNewDeal, phoneDigits } from './policy.ts';
import * as repo from './repository.ts';

export function listDeals(db: Database, staff: Staff) {
  return repo.activeDeals(db, staff.role === 'gm' ? null : staff.id);
}

// The whole record stays on the deal when its owner changes (US8), so the new
// owner reads the same timeline, open items, and appointments as the old one.
export async function dealRecord(db: Database, staff: Staff, dealId: string) {
  const deal = await repo.findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  const { buyerId, buyer, email, phone, preferredChannel, optedOut, ownerId, owner, ...rest } = deal;
  const [timeline, openItems, appointments, assignments] = await Promise.all([
    repo.timeline(db, dealId), repo.openItems(db, dealId),
    repo.appointments(db, dealId), assignmentHistory(db, dealId),
  ]);
  return {
    ...rest,
    buyer: { id: buyerId, name: buyer, email, phone, preferredChannel, optedOut },
    owner: ownerId === null ? null : { id: ownerId, name: owner },
    timeline,
    openItems,
    appointments,
    assignments,
  };
}

// Adds a buyer and their first deal. A buyer whose email or phone is already on
// file is reused, so their history and opt-out stay in one record; only missing
// contact details are filled in. A rep owns the deal they add; a GM's deal starts
// unassigned and appears in the unassigned list for US8.
export async function createDeal(db: Database, staff: Staff, body: Record<string, unknown>) {
  const input = parseNewDeal(body);
  const digits = input.phone === null ? null : phoneDigits(input.phone);
  return db.transaction(async (tx) => {
    if (input.email) await repo.lockContact(tx, `email:${input.email}`);
    if (digits) await repo.lockContact(tx, `phone:${digits}`);
    const matches = await repo.buyersByContact(tx, input.email, digits);
    if (matches.length > 1) {
      throw conflict(`That email and phone belong to different buyers (${matches.map((buyer) => buyer.name).join(', ')}). Check the details.`);
    }
    const existing = matches[0];
    const buyer = existing
      ? await repo.fillMissingContact(tx, existing.id, input.email, input.phone)
      : await repo.insertBuyer(tx, input);

    const owner = staff.role === 'rep' ? { id: staff.id, name: staff.name } : null;
    const deal = await repo.insertDeal(tx, buyer.id, owner?.id ?? null, input);
    const added = `${staff.name} added ${buyer.name}: interested in ${input.vehicleInterest} (source: ${input.source.replaceAll('_', ' ')})`;
    let eventId: string;
    if (owner) {
      const event = await addAssignmentEvent(tx, deal.id, staff, 'assignment', `${added}, owned by ${owner.name}.`);
      await addAssignmentRecord(tx, {
        dealId: deal.id, kind: 'assignment', fromOwnerId: null, toOwnerId: owner.id, assignedBy: staff.id,
        reason: 'New buyer added by this rep', openItemsMoved: 0, eventId: event.id, at: event.createdAt,
      });
      eventId = event.id;
    } else {
      eventId = (await repo.addNoteEvent(tx, deal.id, staff, `${added}.`)).id;
    }

    return {
      dealId: deal.id,
      stage: deal.stage,
      owner,
      // existing: matched a buyer already on file. optedOut: they asked not to be
      // contacted; talk in person, but do not message them until they agree again.
      buyer: { ...buyer, existing: existing !== undefined },
      otherOpenDeals: await repo.otherOpenDeals(tx, buyer.id, deal.id),
      eventId,
    };
  });
}
