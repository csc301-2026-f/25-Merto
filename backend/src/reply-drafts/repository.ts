import type { Queryable } from '../db.ts';
import type { Staff } from '../auth.ts';

export type Decision = 'approve' | 'edit' | 'reject';
export interface DraftContext {
  buyer: string;
  vehicleInterest: string;
  reasons: string[];
  messages: { eventId: string; actorType: string; body: string; createdAt: string }[];
}
export interface Draft {
  id: string;
  dealId: string;
  channel: 'email' | 'sms';
  source: 'simulated_template';
  originalText: string;
  context: DraftContext;
  createdBy: string;
  createdAt: Date;
  decision: Decision | null;
  finalText: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewEventId: string | null;
  sentEventId: string | null;
}

const columns = `id, deal_id as "dealId", channel, source, original_text as "originalText",
  context, created_by as "createdBy", created_at as "createdAt", decision, final_text as "finalText",
  reviewed_by as "reviewedBy", reviewed_at as "reviewedAt", review_event_id as "reviewEventId",
  sent_event_id as "sentEventId"`;

export async function find(db: Queryable, id: string, lock = false): Promise<Draft | undefined> {
  return (await db.query<Draft>(`select ${columns} from public.reply_drafts where id = $1${lock ? ' for update' : ''}`, [id]))[0];
}

export function list(db: Queryable, dealId: string): Promise<Draft[]> {
  return db.query<Draft>(`select ${columns} from public.reply_drafts where deal_id = $1 order by created_at desc, id`, [dealId]);
}

export async function create(db: Queryable, input: {
  id: string; dealId: string; channel: 'email' | 'sms'; originalText: string;
  context: DraftContext; createdBy: string;
}): Promise<Draft> {
  return (await db.query<Draft>(`insert into public.reply_drafts
    (id, deal_id, channel, original_text, context, created_by)
    values ($1, $2, $3, $4, $5::jsonb, $6) returning ${columns}`,
  [input.id, input.dealId, input.channel, input.originalText, JSON.stringify(input.context), input.createdBy]))[0];
}

export async function review(db: Queryable, draft: Draft, staff: Staff, decision: Decision, finalText: string | null): Promise<Draft> {
  const words = { approve: 'approved', edit: 'edited and approved', reject: 'rejected' };
  const body = `${staff.name} ${words[decision]} a simulated ${draft.channel} draft.\nOriginal draft: ${draft.originalText}`
    + (finalText === null ? '\nNo reply approved for sending.' : `\nFinal reply: ${finalText}`);
  const [event] = await db.query<{ id: string }>(`insert into public.timeline_events
    (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, 'draft_review', $2, $3, 'note', 'internal', $4) returning id`,
  [draft.dealId, staff.role, staff.id, body]);
  return (await db.query<Draft>(`update public.reply_drafts set decision = $2, final_text = $3,
    reviewed_by = $4, reviewed_at = now(), review_event_id = $5 where id = $1 returning ${columns}`,
  [draft.id, decision, finalText, staff.id, event.id]))[0];
}

export async function markSent(db: Queryable, id: string, eventId: string): Promise<Draft> {
  return (await db.query<Draft>(`update public.reply_drafts set sent_event_id = $2 where id = $1 returning ${columns}`, [id, eventId]))[0];
}
