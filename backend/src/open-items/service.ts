// US4: unresolved work across buyers. A rep sees and closes items on their own
// deals; the GM sees and closes items on every deal in the store, unassigned ones
// included. Checked here, not in the UI.
import { requireDealAccess, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { conflict, notFound } from '../errors.ts';
import { CLOSED_STAGES } from '../assignment/policy.ts';
import { closeBody, parseCloseNote, parseFilters, type CloseAction } from './policy.ts';
import * as repo from './repository.ts';

export async function openItemsOverview(db: Database, staff: Staff, query: Record<string, unknown>) {
  const filters = parseFilters(query);
  const repId = staff.role === 'gm' ? null : staff.id;
  const [items, byType] = await Promise.all([
    repo.listItems(db, repId, filters), repo.openSummary(db, repId, filters),
  ]);
  const oldest = byType.map((row) => row.oldestCreatedAt.getTime());
  return {
    // Unresolved work in scope, whatever status is being listed. Zero here is a real count.
    summary: {
      open: byType.reduce((sum, row) => sum + row.open, 0),
      overdue: byType.reduce((sum, row) => sum + row.overdue, 0),
      unowned: byType.reduce((sum, row) => sum + row.unowned, 0),
      oldestCreatedAt: oldest.length > 0 ? new Date(Math.min(...oldest)) : null,
      byType: byType.map(({ type, open, overdue, unowned }) => ({ type, open, overdue, unowned })),
    },
    items: items.map(({ dealId, buyer, vehicleInterest, dealStage, dealOwnerId, dealOwner,
      ownerId, owner, ...item }) => ({
      ...item,
      owner: ownerId === null ? null : { id: ownerId, name: owner },
      deal: {
        id: dealId, buyer, vehicleInterest, stage: dealStage,
        owner: dealOwnerId === null ? null : { id: dealOwnerId, name: dealOwner },
      },
    })),
  };
}

// Resolve (the work was done) or cancel (it is no longer needed) one open item,
// and write who did it and why to the buyer's timeline in the same transaction.
export async function closeOpenItem(db: Database, staff: Staff, itemId: string, action: CloseAction,
  body: Record<string, unknown>) {
  const note = parseCloseNote(action, body.note);
  return db.transaction(async (tx) => {
    const item = await repo.lockItem(tx, itemId);
    if (!item) throw notFound('Open item not found.');
    requireDealAccess(staff, item.dealOwnerId);
    if (item.status !== 'open') throw conflict(`This item is already ${item.status}. Reload the page.`);
    if ((CLOSED_STAGES as readonly string[]).includes(item.dealStage)) {
      throw conflict(`This deal is ${item.dealStage}; its work is already closed.`);
    }
    const event = await repo.addItemEvent(tx, item.dealId, staff,
      closeBody(action, item.type, item.buyer, item.description, note));
    const closed = await repo.closeItem(tx, itemId, action === 'resolve' ? 'resolved' : 'cancelled', event.createdAt);
    return {
      id: item.id, dealId: item.dealId, type: item.type, description: item.description,
      status: closed.status, resolvedAt: closed.resolvedAt, note,
      by: { id: staff.id, name: staff.name }, at: event.createdAt, eventId: event.id,
    };
  });
}
