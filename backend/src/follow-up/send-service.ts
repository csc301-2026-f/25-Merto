import { requireDealAccess, type Staff } from '../auth.ts';
import type { Database, Queryable } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { assessFollowUp } from './detect.ts';
import { loadActivity } from './repository.ts';
import { parseFollowUp, SIMULATED_FOLLOW_UP_PREFIX } from './send-policy.ts';
import * as repo from './send-repository.ts';

async function assessment(tx: Queryable, deal: repo.ContactableDeal) {
  return assessFollowUp((await loadActivity(tx, [deal])).get(deal.dealId)!, new Date());
}

// Record a simulated follow-up in the existing timeline.
export async function recordFollowUp(db: Database, staff: Staff, dealId: string, body: Record<string, unknown>) {
  const input = parseFollowUp(body);
  const text = SIMULATED_FOLLOW_UP_PREFIX + input.message;
  return db.transaction(async tx => {
    await repo.lockRequest(tx, input.requestId);
    const deal = await repo.lockDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
    requireDealAccess(staff, deal.ownerId);

    // Return the original event on retry, even if it already cleared the reminder.
    const previous = await repo.findRecorded(tx, input.requestId);
    if (previous && (previous.dealId !== dealId || previous.actorId !== staff.id
      || previous.actorType !== staff.role || previous.eventType !== 'interaction'
      || previous.direction !== 'outbound' || previous.channel !== input.channel || previous.body !== text)) {
      throw conflict('requestId has already been used for a different action.');
    }
    if (!previous) {
      const before = await assessment(tx, deal);
      if (before.status !== 'due') {
        throw conflict(before.suppressions.some(s => s.code === 'opted_out')
          ? 'This customer opted out. No follow-up can be recorded.'
          : 'No follow-up is currently due for this deal. Refresh the customer record.');
      }
      const contact = input.channel === 'email' ? deal.email : deal.phone;
      if (!contact?.trim()) throw badRequest(`This customer has no ${input.channel === 'email' ? 'email address' : 'phone number'} for that channel.`);
    }
    const event = previous ?? await repo.record(tx, {
      ...input, dealId, actor: staff, body: text,
    });
    return {
      eventId: event.id, dealId, status: 'simulated_sent' as const,
      channel: event.channel, message: input.message, recordedAt: event.createdAt,
      alreadyRecorded: previous !== undefined, followUp: await assessment(tx, deal),
    };
  });
}
