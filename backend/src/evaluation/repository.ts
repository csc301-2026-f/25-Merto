// All SQL for the evaluation module. Reads the core tables from the database
// team's contract (supabase/DATA_CONTRACT.md) and writes ai_evaluations,
// ai_flags, and timeline entries. Every value is a bound parameter.
import type { Queryable } from '../db.ts';
import type { Conversation, Issue, TimelineEvent } from './detect.ts';
import type { FlagType, Severity } from './rules.ts';
import type { ReviewDecision, ReviewStatus } from './review-policy.ts';

export interface DealSummary {
  id: string;
  buyer: string;
  ownerId: string | null;
  stage: string;
}

export interface Evaluation {
  dealId: string;
  result: 'passed' | 'flagged';
  evaluatedAt: Date;
}

export interface Flag {
  id: string;
  dealId: string;
  flagType: FlagType;
  severity: Severity;
  explanation: string;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}

export interface FlagWithEvidence extends Flag {
  evidenceEventId: string;
  evidenceChannel: string;
  evidenceBody: string;
  evidenceAt: Date;
}

export interface QueueItem extends FlagWithEvidence {
  buyer: string;
  ownerId: string | null;
  owner: string;
  stage: string;
}

const flagColumns = `f.id, f.deal_id as "dealId", f.flag_type as "flagType", f.severity,
  f.explanation, f.review_status as "reviewStatus", f.reviewed_by as "reviewedBy",
  f.reviewed_at as "reviewedAt", f.review_note as "reviewNote", f.created_at as "createdAt"`;
const evidenceColumns = `e.id as "evidenceEventId", e.channel as "evidenceChannel",
  e.body as "evidenceBody", e.created_at as "evidenceAt"`;
const severityOrder = `case f.severity when 'high' then 1 when 'medium' then 2 else 3 end`;

export async function findDeal(db: Queryable, dealId: string): Promise<DealSummary | undefined> {
  const [deal] = await db.query<DealSummary>(`
    select d.id, b.name as buyer, d.owner_id as "ownerId", d.stage
    from public.deals d join public.buyers b on b.id = d.buyer_id
    where d.id = $1`, [dealId]);
  return deal;
}

export async function loadConversation(db: Queryable, dealId: string): Promise<Conversation> {
  const [events, appointments, openItems, optOuts] = await Promise.all([
    db.query<TimelineEvent>(`
      select id, event_type as "eventType", actor_type as "actorType", direction, body,
        created_at as "createdAt"
      from public.timeline_events where deal_id = $1
      order by created_at, id`, [dealId]),
    db.query<{ at: Date }>(`
      select confirmed_at as at from public.appointments
      where deal_id = $1 and confirmed_at is not null`, [dealId]),
    db.query<{ at: Date }>('select created_at as at from public.open_items where deal_id = $1', [dealId]),
    // Opt-outs on any of this buyer's deals, as in demo query 06.
    db.query<{ at: Date }>(`
      select o.created_at as at from public.timeline_events o
      join public.deals od on od.id = o.deal_id
      join public.deals d on d.buyer_id = od.buyer_id
      where d.id = $1 and o.event_type = 'opt_out'`, [dealId]),
  ]);
  return {
    events,
    appointmentConfirmedAts: appointments.map((row) => row.at),
    openItemCreatedAts: openItems.map((row) => row.at),
    optOutAts: optOuts.map((row) => row.at),
  };
}

// Deals the nightly job evaluates: those with any AI-authored activity.
export async function dealIdsWithAiActivity(db: Queryable): Promise<string[]> {
  const rows = await db.query<{ id: string }>(`
    select d.id from public.deals d
    where exists (select 1 from public.timeline_events t where t.deal_id = d.id and t.actor_type = 'ai')
    order by d.created_at, d.id`);
  return rows.map((row) => row.id);
}

// Upserts the deal's evaluation and adds only flags that do not exist yet, so a
// rerun keeps earlier flags and GM decisions. Returns how many flags were new.
export async function saveEvaluation(tx: Queryable, dealId: string, issues: Issue[]) {
  await tx.query(`
    insert into public.ai_evaluations (deal_id, result) values ($1, 'passed')
    on conflict (deal_id) do update set evaluated_at = now()`, [dealId]);

  let newFlags = 0;
  for (const issue of issues) {
    const inserted = await tx.query(`
      insert into public.ai_flags (deal_id, evidence_event_id, flag_type, severity, explanation)
      values ($1, $2, $3, $4, $5)
      on conflict (evidence_event_id, flag_type) do nothing
      returning id`,
      [dealId, issue.evidenceEventId, issue.flagType, issue.severity, issue.explanation]);
    newFlags += inserted.length;
  }

  const [evaluation] = await tx.query<Evaluation>(`
    update public.ai_evaluations
    set result = case when exists (select 1 from public.ai_flags where deal_id = $1)
      then 'flagged' else 'passed' end
    where deal_id = $1
    returning deal_id as "dealId", result, evaluated_at as "evaluatedAt"`, [dealId]);

  if (newFlags > 0) {
    await tx.query(`
      insert into public.timeline_events (deal_id, event_type, actor_type, channel, direction, body)
      values ($1, 'ai_evaluation', 'system', 'note', 'internal', $2)`,
      [dealId, `AI evaluation raised ${newFlags} flag(s) for GM review.`]);
  }
  return { ...evaluation, newFlags };
}

export async function findEvaluation(db: Queryable, dealId: string): Promise<Evaluation | undefined> {
  const [evaluation] = await db.query<Evaluation>(`
    select deal_id as "dealId", result, evaluated_at as "evaluatedAt"
    from public.ai_evaluations where deal_id = $1`, [dealId]);
  return evaluation;
}

export function dealFlags(db: Queryable, dealId: string): Promise<FlagWithEvidence[]> {
  return db.query<FlagWithEvidence>(`
    select ${flagColumns}, ${evidenceColumns}
    from public.ai_flags f join public.timeline_events e on e.id = f.evidence_event_id
    where f.deal_id = $1
    order by e.created_at, ${severityOrder}, f.flag_type`, [dealId]);
}

// Pending flags, highest severity and oldest evidence first. With an owner,
// only that rep's deals.
export function pendingFlags(db: Queryable, ownerId: string | null): Promise<QueueItem[]> {
  return db.query<QueueItem>(`
    select ${flagColumns}, ${evidenceColumns}, b.name as buyer, d.owner_id as "ownerId",
      coalesce(s.name, 'Unassigned') as owner, d.stage
    from public.ai_flags f
    join public.timeline_events e on e.id = f.evidence_event_id
    join public.deals d on d.id = f.deal_id
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users s on s.id = d.owner_id
    where f.review_status = 'pending' and ($1::uuid is null or d.owner_id = $1::uuid)
    order by ${severityOrder}, e.created_at, f.id`, [ownerId]);
}

export async function lockFlag(tx: Queryable, flagId: string): Promise<Flag | undefined> {
  const [flag] = await tx.query<Flag>(
    `select ${flagColumns} from public.ai_flags f where f.id = $1 for update`, [flagId]);
  return flag;
}

// Records the decision and puts it on the deal's timeline in the same transaction.
export async function saveReview(tx: Queryable, flag: Flag, reviewerId: string,
  decision: ReviewDecision, note: string | null): Promise<Flag> {
  const [reviewed] = await tx.query<Flag>(`
    update public.ai_flags f
    set review_status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4
    where f.id = $1
    returning ${flagColumns}`, [flag.id, decision, reviewerId, note]);

  const label = (value: string) => value.replaceAll('_', ' ');
  await tx.query(`
    insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, 'ai_review', 'gm', $2, 'note', 'internal', $3)`,
    [flag.dealId, reviewerId, `GM review of AI flag (${label(flag.flagType)}): ${label(decision)}.`
      + (note ? ` Note: ${note}` : '')]);
  return reviewed;
}

export async function evaluationCounts(db: Queryable) {
  const [counts] = await db.query<{
    evaluated: number; flagged: number; pending: number;
    confirmedIssue: number; falsePositive: number; resolved: number;
  }>(`
    select
      (select count(*)::int from public.ai_evaluations) as evaluated,
      (select count(*)::int from public.ai_evaluations where result = 'flagged') as flagged,
      count(*) filter (where review_status = 'pending')::int as pending,
      count(*) filter (where review_status = 'confirmed_issue')::int as "confirmedIssue",
      count(*) filter (where review_status = 'false_positive')::int as "falsePositive",
      count(*) filter (where review_status = 'resolved')::int as resolved
    from public.ai_flags`);
  return counts;
}
