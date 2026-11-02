import { createHash } from 'node:crypto';
import { requireDealAccess, requireUuid, type Staff } from '../auth.ts';
import type { Database, Queryable } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { assessFollowUp } from '../follow-up/detect.ts';
import { findDeal, loadActivity } from '../follow-up/repository.ts';
import { findRecorded, lockDeal, lockRequest, type ContactableDeal } from '../follow-up/send-repository.ts';
import { recordFollowUp } from '../follow-up/send-service.ts';
import { MAX_FOLLOW_UP_LENGTH } from '../follow-up/send-policy.ts';
import * as repo from './repository.ts';
import { groqReplyGenerator, validateGeneratedText, type ReplyGenerator } from './generator.ts';

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

// Review events and elapsed reminder wording do not invalidate a draft. Changes
// to actual deal data do, including messages, ownership, appointments and work.
async function draftContext(db: Queryable, deal: ContactableDeal): Promise<repo.DraftContext> {
  const activity = (await loadActivity(db, [deal])).get(deal.dealId)!;
  const assessment = assessFollowUp(activity, new Date());
  const interactions = activity.events.filter(event => event.eventType === 'interaction');
  const version = createHash('sha256').update(JSON.stringify({
    buyer: deal.buyer, vehicle: deal.vehicleInterest, owner: deal.ownerId,
    stage: deal.stage, email: deal.email, phone: deal.phone,
    interactions, appointments: activity.appointments, openItems: activity.openItems,
  })).digest('hex');
  return {
    activityVersion: version, buyer: deal.buyer, vehicleInterest: deal.vehicleInterest, stage: deal.stage,
    reasons: assessment.reasons.map(reason => reason.text),
    messages: interactions.slice(-10).map(event => ({ eventId: event.id, actorType: event.actorType,
      body: event.body.slice(0, 1500), createdAt: event.createdAt.toISOString() })),
    appointments: activity.appointments.slice(-10).map(item => ({
      scheduledFor: item.scheduledFor.toISOString(), status: item.status,
    })),
    openItems: activity.openItems.filter(item => item.status === 'open').slice(0, 10).map(item => ({
      type: item.type, description: item.description.slice(0, 500), dueAt: item.dueAt?.toISOString() ?? null,
    })),
  };
}

async function requireFresh(db: Queryable, deal: ContactableDeal, draft: repo.Draft) {
  if (draft.source === 'groq_ai' && draft.context.activityVersion !== (await draftContext(db, deal)).activityVersion) {
    throw conflict('This draft is out of date because the deal changed. Generate a new reply and review it.');
  }
}

export async function createDraft(db: Database, staff: Staff, dealId: string, body: Record<string, unknown>,
  generate: ReplyGenerator = groqReplyGenerator({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL })) {
  if (typeof body.requestId !== 'string') throw badRequest('requestId must be a UUID.');
  const id = requireUuid(body.requestId, 'requestId');
  if (body.channel !== 'email' && body.channel !== 'sms') throw badRequest('channel must be email or sms.');
  const channel = body.channel;
  const prepare = async (tx: Queryable) => {
    await lockRequest(tx, id);
    const deal = await lockDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
    requireDealAccess(staff, deal.ownerId);
    const previous = await repo.find(tx, id);
    if (previous) {
      if (previous.dealId !== dealId || previous.channel !== channel || previous.createdBy !== staff.id) {
        throw conflict('requestId is already used by a different draft.');
      }
      return { previous, deal, context: previous.context };
    }
    if (await findRecorded(tx, id)) throw conflict('requestId is already used by a timeline event.');
    await eligible(tx, deal, channel);
    return { previous, deal, context: await draftContext(tx, deal) };
  };
  const snapshot = await db.transaction(prepare);
  if (snapshot.previous) return snapshot.previous;
  // Never hold a database connection or row lock while waiting for the model.
  const generated = await generate({ channel, repName: staff.name, context: snapshot.context });
  const originalText = generated.source === 'groq_ai' ? validateGeneratedText(generated.text) : generated.text;
  return db.transaction(async tx => {
    const current = await prepare(tx);
    if (current.previous) return current.previous;
    if (current.context.activityVersion !== snapshot.context.activityVersion) {
      throw conflict('The deal changed while the reply was generated. Please generate another draft.');
    }
    return repo.create(tx, { id, dealId, channel, originalText, createdBy: staff.id,
      context: snapshot.context, generated });
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
    if (decision !== 'reject') {
      await eligible(tx, deal, draft.channel);
      await requireFresh(tx, deal, draft);
    }
    return repo.review(tx, draft, staff, decision, finalText);
  });
}

export function sendDraft(db: Database, staff: Staff, id: string) {
  return withDraft(db, staff, id, async (tx, draft, deal) => {
    if ((draft.decision !== 'approve' && draft.decision !== 'edit') || draft.finalText === null) {
      throw conflict('Only an approved draft can be sent.');
    }
    if (!draft.sentEventId) await requireFresh(tx, deal, draft);
    const scoped: Database = { query: tx.query, transaction: work => work(tx), close: async () => {} };
    const sent = await recordFollowUp(scoped, staff, draft.dealId,
      { requestId: draft.id, channel: draft.channel, message: draft.finalText });
    return { ...sent, draft: await repo.markSent(tx, draft.id, sent.eventId) };
  });
}
