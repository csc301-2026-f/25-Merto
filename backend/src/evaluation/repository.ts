// All SQL for the evaluation module. Reads the core tables from the database
// team's contract (supabase/DATA_CONTRACT.md) and writes ai_evaluations,
// ai_flags, and timeline entries. Every value is a bound parameter.
import type { Queryable } from '../db.ts';
import type { Conversation, Issue, TimelineEvent } from './detect.ts';
import type { FlagType, Severity } from './rules.ts';
import type { ReviewDecision, ReviewReason, ReviewStatus, SecondReview } from './review-policy.ts';
import { evaluationTables } from './store.ts';

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
  // The model version of the latest run; null for the deterministic rules.
  modelVersion: string | null;
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
  reviewReason: ReviewReason | null;
  // 'manual' when a GM added the flag to a reply the evaluator did not flag.
  source: 'evaluator' | 'manual';
  createdBy: string | null;
  // The model version that raised the flag or, for a manual flag, missed it.
  modelVersion: string | null;
  // The model's probability for this flag's signal, recorded at review time.
  modelScore: number | null;
  secondReview: SecondReview | null;
  secondReviewedBy: string | null;
  secondReviewedAt: Date | null;
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
  f.reviewed_at as "reviewedAt", f.review_note as "reviewNote", f.review_reason as "reviewReason",
  f.source, f.created_by as "createdBy", f.model_version as "modelVersion", f.model_score as "modelScore",
  f.second_review as "secondReview", f.second_reviewed_by as "secondReviewedBy",
  f.second_reviewed_at as "secondReviewedAt", f.created_at as "createdAt"`;
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
  // Evaluations call this inside a transaction with one PostgreSQL connection.
  // Run reads in sequence rather than queue concurrent queries on that client.
  const events = await db.query<TimelineEvent>(`
      select id, event_type as "eventType", actor_type as "actorType", direction, body,
        created_at as "createdAt"
      from public.timeline_events where deal_id = $1
      order by created_at, id`, [dealId]);
  const appointments = await db.query<{ at: Date }>(`
      select confirmed_at as at from public.appointments
      where deal_id = $1 and confirmed_at is not null`, [dealId]);
  const openItems = await db.query<{ at: Date }>('select created_at as at from public.open_items where deal_id = $1', [dealId]);
  // Opt-outs on any of this buyer's deals, as in demo query 06.
  const optOuts = await db.query<{ at: Date }>(`
      select o.created_at as at from public.timeline_events o
      join public.deals od on od.id = o.deal_id
      join public.deals d on d.buyer_id = od.buyer_id
      where d.id = $1 and o.event_type = 'opt_out'`, [dealId]);
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
export async function saveEvaluation(tx: Queryable, dealId: string, issues: Issue[], modelVersion: string | null) {
  await tx.query(`
    insert into ${evaluationTables(tx).evaluations} (deal_id, result, model_version) values ($1, 'passed', $2)
    on conflict (deal_id) do update set evaluated_at = now(), model_version = excluded.model_version`,
    [dealId, modelVersion]);

  let newFlags = 0;
  for (const issue of issues) {
    const inserted = await tx.query(`
      insert into ${evaluationTables(tx).flags} (deal_id, evidence_event_id, flag_type, severity, explanation, model_version)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (evidence_event_id, flag_type) do nothing
      returning id`,
      [dealId, issue.evidenceEventId, issue.flagType, issue.severity, issue.explanation, modelVersion]);
    newFlags += inserted.length;
  }

  const [evaluation] = await tx.query<Evaluation>(`
    update ${evaluationTables(tx).evaluations}
    set result = case when exists (select 1 from ${evaluationTables(tx).flags} where deal_id = $1)
      then 'flagged' else 'passed' end
    where deal_id = $1
    returning deal_id as "dealId", result, evaluated_at as "evaluatedAt", model_version as "modelVersion"`, [dealId]);

  if (newFlags > 0) {
    await tx.query(`
      insert into public.timeline_events (deal_id, event_type, actor_type, channel, direction, body)
      values ($1, 'ai_evaluation', 'system', 'note', 'internal', $2)`,
      [dealId, `${evaluationTables(tx).label} AI evaluation raised ${newFlags} flag(s) for GM review.`]);
  }
  return { ...evaluation, newFlags };
}

export async function findEvaluation(db: Queryable, dealId: string): Promise<Evaluation | undefined> {
  const [evaluation] = await db.query<Evaluation>(`
    select deal_id as "dealId", result, evaluated_at as "evaluatedAt", model_version as "modelVersion"
    from ${evaluationTables(db).evaluations} where deal_id = $1`, [dealId]);
  return evaluation;
}

export function dealFlags(db: Queryable, dealId: string): Promise<FlagWithEvidence[]> {
  return db.query<FlagWithEvidence>(`
    select ${flagColumns}, ${evidenceColumns}
    from ${evaluationTables(db).flags} f join public.timeline_events e on e.id = f.evidence_event_id
    where f.deal_id = $1
    order by e.created_at, ${severityOrder}, f.flag_type`, [dealId]);
}

// Pending flags, highest severity and oldest evidence first. With an owner,
// only that rep's deals.
export function pendingFlags(db: Queryable, ownerId: string | null): Promise<QueueItem[]> {
  return db.query<QueueItem>(`
    select ${flagColumns}, ${evidenceColumns}, b.name as buyer, d.owner_id as "ownerId",
      coalesce(s.name, 'Unassigned') as owner, d.stage
    from ${evaluationTables(db).flags} f
    join public.timeline_events e on e.id = f.evidence_event_id
    join public.deals d on d.id = f.deal_id
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users s on s.id = d.owner_id
    where f.review_status = 'pending' and ($1::uuid is null or d.owner_id = $1::uuid)
    order by ${severityOrder}, e.created_at, f.id`, [ownerId]);
}

export async function lockFlag(tx: Queryable, flagId: string): Promise<Flag | undefined> {
  const [flag] = await tx.query<Flag>(
    `select ${flagColumns} from ${evaluationTables(tx).flags} f where f.id = $1 for update`, [flagId]);
  return flag;
}

const label = (value: string) => value.replaceAll('_', ' ');

// Records the decision and puts it on the deal's timeline in the same transaction.
// The reason is kept only for a false positive.
// A new decision clears any second opinion, which was about the old one.
export async function saveReview(tx: Queryable, flag: Flag, reviewerId: string,
  decision: ReviewDecision, note: string | null, reason: ReviewReason | null, modelScore: number | null): Promise<Flag> {
  const [reviewed] = await tx.query<Flag>(`
    update ${evaluationTables(tx).flags} f
    set review_status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4, review_reason = $5,
      model_score = $6, second_review = null, second_reviewed_by = null, second_reviewed_at = null
    where f.id = $1
    returning ${flagColumns}`, [flag.id, decision, reviewerId, note, reason, modelScore]);

  await tx.query(`
    insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, 'ai_review', 'gm', $2, 'note', 'internal', $3)`,
    [flag.dealId, reviewerId, `GM review of ${evaluationTables(tx).label} AI flag (${label(flag.flagType)}): ${label(decision)}.`
      + (reason ? ` Reason: ${label(reason)}.` : '') + (note ? ` Note: ${note}` : '')]);
  return reviewed;
}

export interface AiReply {
  id: string;
  channel: string;
  body: string;
  createdAt: Date;
}

// The deal's AI-sent replies that have no flag yet, oldest first: where a GM
// can add a problem the evaluator missed.
export function unflaggedAiReplies(db: Queryable, dealId: string): Promise<AiReply[]> {
  return db.query<AiReply>(`
    select e.id, e.channel, e.body, e.created_at as "createdAt"
    from public.timeline_events e
    where e.deal_id = $1 and e.actor_type = 'ai' and e.direction = 'outbound'
      and not exists (select 1 from ${evaluationTables(db).flags} f where f.evidence_event_id = e.id)
    order by e.created_at, e.id`, [dealId]);
}

export async function findAiReply(db: Queryable, dealId: string, eventId: string): Promise<AiReply | undefined> {
  const [reply] = await db.query<AiReply>(`
    select id, channel, body, created_at as "createdAt" from public.timeline_events
    where id = $1 and deal_id = $2 and actor_type = 'ai' and direction = 'outbound'`, [eventId, dealId]);
  return reply;
}

// A GM-added flag is already judged, so it starts as a confirmed issue that
// still needs resolving. It records the version of the deal's latest run: the
// model that missed the problem. Returns undefined if the reply already has this flag.
export async function saveManualFlag(tx: Queryable, dealId: string, eventId: string, flagType: FlagType,
  severity: Severity, explanation: string, gmId: string, note: string | null,
  modelScore: number | null): Promise<Flag | undefined> {
  const [flag] = await tx.query<Flag>(`
    insert into ${evaluationTables(tx).flags} as f (deal_id, evidence_event_id, flag_type, severity, explanation,
      review_status, reviewed_by, reviewed_at, review_note, source, created_by, model_version, model_score)
    values ($1, $2, $3, $4, $5, 'confirmed_issue', $6, now(), $7, 'manual', $6,
      (select model_version from ${evaluationTables(tx).evaluations} where deal_id = $1), $8)
    on conflict (evidence_event_id, flag_type) do nothing
    returning ${flagColumns}`, [dealId, eventId, flagType, severity, explanation, gmId, note, modelScore]);
  if (!flag) return undefined;

  await tx.query(`update ${evaluationTables(tx).evaluations} set result = 'flagged' where deal_id = $1`, [dealId]);
  await tx.query(`
    insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, 'ai_review', 'gm', $2, 'note', 'internal', $3)`,
    [dealId, gmId, `GM flagged an AI reply the ${evaluationTables(tx).label} evaluation missed (${label(flagType)}).`
      + (note ? ` Note: ${note}` : '')]);
  return flag;
}

export async function evaluationCounts(db: Queryable) {
  // Review counts cover evaluator flags only: GM-added flags are not the
  // evaluator's output, so they count as misses instead.
  const [counts] = await db.query<{
    evaluated: number; flagged: number; pending: number;
    confirmedIssue: number; falsePositive: number; resolved: number; manual: number;
    misreadWording: number; alreadyHandled: number; visitConfirmed: number; notAProblem: number; other: number;
  }>(`
    select
      (select count(*)::int from ${evaluationTables(db).evaluations}) as evaluated,
      (select count(*)::int from ${evaluationTables(db).evaluations} where result = 'flagged') as flagged,
      count(*) filter (where source = 'evaluator' and review_status = 'pending')::int as pending,
      count(*) filter (where source = 'evaluator' and review_status = 'confirmed_issue')::int as "confirmedIssue",
      count(*) filter (where source = 'evaluator' and review_status = 'false_positive')::int as "falsePositive",
      count(*) filter (where source = 'evaluator' and review_status = 'resolved')::int as resolved,
      count(*) filter (where source = 'manual')::int as manual,
      count(*) filter (where source = 'evaluator' and review_reason = 'misread_wording')::int as "misreadWording",
      count(*) filter (where source = 'evaluator' and review_reason = 'already_handled')::int as "alreadyHandled",
      count(*) filter (where source = 'evaluator' and review_reason = 'visit_confirmed')::int as "visitConfirmed",
      count(*) filter (where source = 'evaluator' and review_reason = 'not_a_problem')::int as "notAProblem",
      count(*) filter (where source = 'evaluator' and review_reason = 'other')::int as other
    from ${evaluationTables(db).flags}`);
  return counts;
}

// One row per flag in either evaluator's store, reviewed or not, for the
// training-label export; training-labels.ts decides which rows become labels.
// For a missed handoff the evidence is the AI reply, so buyerTurn holds the
// buyer messages that reply answered: those since the previous AI reply, the
// same pairing detectIssues uses. It is empty for every other flag type.
export interface FlagForTraining {
  store: 'deterministic' | 'mpnet';
  flagId: string;
  dealId: string;
  flagType: FlagType;
  source: 'evaluator' | 'manual';
  reviewStatus: ReviewStatus;
  reviewReason: ReviewReason | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  modelVersion: string | null;
  modelScore: number | null;
  secondReview: SecondReview | null;
  evidenceEventId: string;
  evidenceBody: string;
  buyerTurn: { id: string; body: string }[];
}

export function flagsForTraining(db: Queryable): Promise<FlagForTraining[]> {
  const columns = `id, deal_id, evidence_event_id, flag_type, source, review_status, review_reason,
    reviewed_by, reviewed_at, model_version, model_score, second_review`;
  return db.query<FlagForTraining>(`
    with flags as (
      select 'deterministic' as store, ${columns} from public.ai_flags
      union all
      select 'mpnet' as store, ${columns} from public.mpnet_flags
    )
    select f.store, f.id as "flagId", f.deal_id as "dealId", f.flag_type as "flagType", f.source,
      f.review_status as "reviewStatus", f.review_reason as "reviewReason", f.reviewed_by as "reviewedBy",
      f.reviewed_at as "reviewedAt", f.model_version as "modelVersion", f.model_score as "modelScore",
      f.second_review as "secondReview", e.id as "evidenceEventId", e.body as "evidenceBody",
      coalesce(turn.messages, '[]'::json) as "buyerTurn"
    from flags f
    join public.timeline_events e on e.id = f.evidence_event_id
    left join lateral (
      select json_agg(json_build_object('id', b.id, 'body', b.body) order by b.created_at, b.id) as messages
      from public.timeline_events b
      where f.flag_type in ('missed_escalation', 'missed_price_handoff')
        and b.deal_id = f.deal_id and b.actor_type = 'buyer' and b.direction = 'inbound'
        and (b.created_at, b.id) < (e.created_at, e.id)
        and not exists (
          select 1 from public.timeline_events a
          where a.deal_id = f.deal_id and a.actor_type = 'ai' and a.direction = 'outbound'
            and (a.created_at, a.id) > (b.created_at, b.id) and (a.created_at, a.id) < (e.created_at, e.id))
    ) turn on true
    order by f.store, f.deal_id, e.created_at, f.id`);
}

// Where a flag points: its deal, the flagged message and the flag type.
export async function flagTarget(db: Queryable, flagId: string) {
  const [target] = await db.query<{ dealId: string; evidenceEventId: string; flagType: FlagType }>(`
    select deal_id as "dealId", evidence_event_id as "evidenceEventId", flag_type as "flagType"
    from ${evaluationTables(db).flags} where id = $1`, [flagId]);
  return target;
}

export interface SecondReviewCandidate extends FlagWithEvidence {
  buyer: string;
  reviewer: string;
  // The buyer's latest message before the flagged reply, for buyer-side flags.
  buyerMessage: string | null;
}

// Reviewed flags with a model score and no second opinion yet. The service
// keeps the ones that strongly disagree with the model.
export function secondReviewCandidates(db: Queryable): Promise<SecondReviewCandidate[]> {
  return db.query<SecondReviewCandidate>(`
    select ${flagColumns}, ${evidenceColumns}, b.name as buyer, s.name as reviewer,
      (select m.body from public.timeline_events m
        where m.deal_id = f.deal_id and m.actor_type = 'buyer' and m.direction = 'inbound'
          and (m.created_at, m.id) < (e.created_at, e.id)
        order by m.created_at desc, m.id desc limit 1) as "buyerMessage"
    from ${evaluationTables(db).flags} f
    join public.timeline_events e on e.id = f.evidence_event_id
    join public.deals d on d.id = f.deal_id
    join public.buyers b on b.id = d.buyer_id
    join public.staff_users s on s.id = f.reviewed_by
    where f.review_status <> 'pending' and f.model_score is not null and f.second_review is null
    order by f.reviewed_at, f.id`);
}

export async function saveSecondReview(tx: Queryable, flag: Flag, staffId: string, decision: SecondReview): Promise<Flag> {
  const [saved] = await tx.query<Flag>(`
    update ${evaluationTables(tx).flags} f
    set second_review = $2, second_reviewed_by = $3, second_reviewed_at = now()
    where f.id = $1
    returning ${flagColumns}`, [flag.id, decision, staffId]);
  await tx.query(`
    insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, 'ai_review', 'gm', $2, 'note', 'internal', $3)`,
  [flag.dealId, staffId, `Second GM opinion on the ${label(flag.flagType)} review: ${decision}.`]);
  return saved;
}
