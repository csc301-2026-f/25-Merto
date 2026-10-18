// US4: unresolved work across buyers. Read-only. A rep sees items on their own
// deals; the GM sees every deal in the store, unassigned ones included. Checked
// here, not in the UI.
import type { Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { parseFilters } from './policy.ts';
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
