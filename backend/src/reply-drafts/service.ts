import { requireDealAccess, requireUuid, type Staff } from '../auth.ts';
import type { Database, Queryable } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { assessFollowUp } from '../follow-up/detect.ts';
import { findDeal, loadActivity } from '../follow-up/repository.ts';
import { findRecorded, lockDeal, lockRequest, type ContactableDeal } from '../follow-up/send-repository.ts';
import { recordFollowUp } from '../follow-up/send-service.ts';
import { MAX_FOLLOW_UP_LENGTH } from '../follow-up/send-policy.ts';
import * as repo from './repository.ts';

async function eligible(db: Queryable, deal: ContactableDeal, channel: 'email' | 'sms') {
  const activity = (await loadActivity(db, [deal])).get(deal.dealId)!;
  const assessment = assessFollowUp(activity, new Date());
  if (assessment.status !== 'due') throw conflict('This customer is not eligible for follow-up. Refresh the record.');
  if (!(channel === 'email' ? deal.email : deal.phone)?.trim()) throw badRequest('No contact details are available for that channel.');
  return { activity, assessment };
}

export async function listDrafts(db: Database, staff: Staff, dealId: string) {
  const deal = await findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  return repo.list(db, dealId);
}

export async function createDraft(db: Database, staff: Staff, dealId: string, body: Record<string, unknown>) {
  if (typeof body.requestId !== 'string') throw badRequest('requestId must be a UUID.');
  const id = requireUuid(body.requestId, 'requestId');
  if (body.channel !== 'email' && body.channel !== 'sms') throw badRequest('channel must be email or sms.');
  const channel = body.channel;
  return db.transaction(async tx => {
    await lockRequest(tx, id);
    const deal = await lockDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
    requireDealAccess(staff, deal.ownerId);
    const previous = await repo.find(tx, id);
    if (previous) {
      if (previous.dealId !== dealId || previous.channel !== channel || previous.createdBy !== staff.id) {
        throw conflict('requestId is already used by a different draft.');
      }
      return previous;
    }
    if (await findRecorded(tx, id)) throw conflict('requestId is already used by a timeline event.');
    const { activity, assessment } = await eligible(tx, deal, channel);
    const visit = assessment.reasons.some(reason => reason.code === 'visit_no_follow_up' || reason.code === 'missed_appointment');
    const originalText = `Hi ${deal.buyer}, this is ${staff.name} from the sales team. `
      + (visit ? 'I wanted to follow up after your planned visit. ' : 'I wanted to follow up on your enquiry. ')
      + `What questions can I help with about ${deal.vehicleInterest}?`;
    return repo.create(tx, {
      id, dealId, channel, originalText, createdBy: staff.id,
      context: { buyer: deal.buyer, vehicleInterest: deal.vehicleInterest,
        reasons: assessment.reasons.map(reason => reason.text),
        messages: activity.events.filter(event => event.eventType === 'interaction').slice(-5)
          .map(event => ({ eventId: event.id, actorType: event.actorType, body: event.body, createdAt: event.createdAt.toISOString() })) },
    });
  });
}

async function withDraft<T>(db: Database, staff: Staff, id: string,
  work: (tx: Queryable, draft: repo.Draft, deal: ContactableDeal) => Promise<T>) {
  return db.transaction(async tx => {
    await lockRequest(tx, id);
    const found = await repo.find(tx, id);
    if (!found) throw notFound('Draft not found.');
    const deal = await lockDeal(tx, found.dealId);
    if (!deal) throw notFound('Deal not found.');
    requireDealAccess(staff, deal.ownerId);
    const draft = (await repo.find(tx, id, true))!;
    return work(tx, draft, deal);
  });
}

export function reviewDraft(db: Database, staff: Staff, id: string, body: Record<string, unknown>) {
  if (body.decision !== 'approve' && body.decision !== 'edit' && body.decision !== 'reject') throw badRequest('Choose approve, edit, or reject.');
  const decision = body.decision;
  if (decision !== 'edit' && body.message !== undefined) throw badRequest('Use edit to change the draft text.');
  if (decision === 'edit' && (typeof body.message !== 'string' || !body.message.trim()
    || body.message.trim().length > MAX_FOLLOW_UP_LENGTH)) throw badRequest('Edited reply must contain 1 to 2000 characters.');
  const edited = typeof body.message === 'string' ? body.message.trim() : null;
  return withDraft(db, staff, id, async (tx, draft, deal) => {
    const finalText = decision === 'reject' ? null : decision === 'approve' ? draft.originalText : edited;
    if (decision === 'edit' && finalText === draft.originalText) throw badRequest('The text is unchanged. Choose approve instead.');
    if (draft.decision !== null) {
      if (draft.decision === decision && draft.finalText === finalText) return draft;
      throw conflict('This draft has already been reviewed. Create a new draft to change the reply.');
    }
    if (decision !== 'reject') await eligible(tx, deal, draft.channel);
    return repo.review(tx, draft, staff, decision, finalText);
  });
}

export function sendDraft(db: Database, staff: Staff, id: string) {
  return withDraft(db, staff, id, async (tx, draft) => {
    if ((draft.decision !== 'approve' && draft.decision !== 'edit') || draft.finalText === null) {
      throw conflict('Only an approved draft can be sent.');
    }
    const scoped: Database = { query: tx.query, transaction: work => work(tx), close: async () => {} };
    const sent = await recordFollowUp(scoped, staff, draft.dealId,
      { requestId: draft.id, channel: draft.channel, message: draft.finalText });
    return { ...sent, draft: await repo.markSent(tx, draft.id, sent.eventId) };
  });
}
