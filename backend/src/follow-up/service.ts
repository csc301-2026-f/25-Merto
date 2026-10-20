// US6: which buyers need a follow-up, and why. Read-only. A rep sees their own
// deals; the GM sees every deal, unassigned ones included. Checked here, not in the UI.
import { requireDealAccess, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { notFound } from '../errors.ts';
import { assessFollowUp } from './detect.ts';
import * as repo from './repository.ts';

const summary = (deal: repo.FollowUpDeal) => ({
  dealId: deal.dealId,
  buyer: { id: deal.buyerId, name: deal.buyer },
  vehicleInterest: deal.vehicleInterest,
  stage: deal.stage,
  owner: deal.ownerId === null ? null : { id: deal.ownerId, name: deal.owner },
});

// Buyers due a follow-up now, most overdue first.
export async function dueFollowUps(db: Database, staff: Staff, now = new Date()) {
  const deals = await repo.openDeals(db, staff.role === 'gm' ? null : staff.id);
  const activity = await repo.loadActivity(db, deals);
  return deals
    .map((deal) => ({ deal, assessment: assessFollowUp(activity.get(deal.dealId)!, now) }))
    .filter(({ assessment }) => assessment.status === 'due')
    .sort((a, b) => a.assessment.dueAt!.getTime() - b.assessment.dueAt!.getTime()
      || a.deal.dealId.localeCompare(b.deal.dealId))
    .map(({ deal, assessment }) => ({
      ...summary(deal), dueAt: assessment.dueAt, reasons: assessment.reasons,
    }));
}

// One buyer's follow-up status: due (with reasons), not due, or suppressed (with why).
export async function dealFollowUp(db: Database, staff: Staff, dealId: string, now = new Date()) {
  const deal = await repo.findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  const activity = await repo.loadActivity(db, [deal]);
  return { ...summary(deal), ...assessFollowUp(activity.get(dealId)!, now) };
}
