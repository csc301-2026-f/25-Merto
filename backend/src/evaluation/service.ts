// The evaluation action layer: the same functions serve the UI and, later, AI
// agents, and each one checks permissions itself rather than trusting the caller.
import { requireDealAccess, requireGm, requireUuid, type Staff } from '../auth.ts';
import type { Database, Queryable } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { detectIssues } from './detect.ts';
import { rulesEngine, runVersion, type EvaluationEngine, type IssueDetector } from './engine.ts';
import * as repo from './repository.ts';
import { FLAG_SIGNALS } from './model-engine.ts';
import {
  REVIEW_DECISIONS, REVIEW_REASONS, SECOND_REVIEWS, dealReviewStatus, isAllowedReview, isDisputed,
  isReviewDecision, isReviewReason, isSecondReview, reviewLabel,
} from './review-policy.ts';
import { DEFAULT_RULES, FLAG_TYPES, type FlagType } from './rules.ts';

async function accessibleDeal(db: Queryable, staff: Staff, dealId: string) {
  const deal = await repo.findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  return deal;
}

// A rate is "not measured" (null), never 0, when there is nothing to divide by.
const ratio = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100) / 100);

// Dry run with the selected evaluator. Writes nothing.
export async function previewDeal(db: Database, staff: Staff, dealId: string, detect: IssueDetector = detectIssues) {
  await accessibleDeal(db, staff, dealId);
  const conversation = await repo.loadConversation(db, dealId);
  const bodies = new Map(conversation.events.map((event) => [event.id, event.body]));
  return (await detect(conversation)).map((issue) => ({
    ...issue, evidenceBody: bodies.get(issue.evidenceEventId),
  }));
}

// Saves the run with the engine's version, so each flag records which model raised it.
function saveRun(db: Database, dealId: string, engine: EvaluationEngine, modelVersion: string | null) {
  return db.transaction(async (tx) => {
    const deal = await repo.findDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
    const issues = await engine.detect(await repo.loadConversation(tx, dealId));
    return { buyer: deal.buyer, ...await repo.saveEvaluation(tx, dealId, issues, modelVersion) };
  });
}

export async function evaluateDeal(db: Database, staff: Staff, dealId: string, engine: EvaluationEngine = rulesEngine) {
  requireGm(staff, 'run AI evaluations');
  return saveRun(db, dealId, engine, await runVersion(engine));
}

// The nightly job. Each deal is its own transaction, so one failure does not
// undo the deals evaluated before it.
export async function evaluateAllDeals(db: Database, staff: Staff, engine: EvaluationEngine = rulesEngine) {
  requireGm(staff, 'run AI evaluations');
  return evaluateDeals(db, staff, await repo.dealIdsWithAiActivity(db), engine);
}

export async function evaluateDeals(db: Database, staff: Staff, dealIds: string[], engine: EvaluationEngine) {
  requireGm(staff, 'run AI evaluations');
  const modelVersion = await runVersion(engine);
  const results = [];
  for (const dealId of dealIds) results.push(await saveRun(db, dealId, engine, modelVersion));
  return results;
}

// AI activity on the buyer record: the review state and every flag with its evidence.
export async function dealEvaluation(db: Database, staff: Staff, dealId: string) {
  const deal = await accessibleDeal(db, staff, dealId);
  const [evaluation, flags, unflaggedReplies] = await Promise.all([
    repo.findEvaluation(db, dealId), repo.dealFlags(db, dealId), repo.unflaggedAiReplies(db, dealId),
  ]);
  return {
    dealId,
    buyer: deal.buyer,
    status: dealReviewStatus(evaluation !== undefined, flags.map((flag) => flag.reviewStatus)),
    evaluatedAt: evaluation?.evaluatedAt ?? null,
    modelVersion: evaluation?.modelVersion ?? null,
    flags,
    // AI replies with no flag, where a GM can add a problem the evaluator missed.
    unflaggedReplies,
  };
}

// Flag types a GM can add by hand. ignored_opt_out comes from send history, so
// an evaluation always finds it; the rest depend on how a reply reads.
export const MANUAL_FLAG_TYPES: readonly FlagType[] = FLAG_TYPES.filter((type) => type !== 'ignored_opt_out');

// A GM marks an AI reply with a problem the evaluator did not flag. The flag
// goes into the selected evaluator's results as a confirmed issue to resolve.
export async function addManualFlag(db: Database, staff: Staff, dealId: string,
  evidenceEventId: unknown, flagType: unknown, note: unknown, engine?: EvaluationEngine) {
  requireGm(staff, 'flag AI replies');
  if (typeof evidenceEventId !== 'string') throw badRequest('evidenceEventId must be a UUID.');
  requireUuid(evidenceEventId, 'evidenceEventId');
  if (!MANUAL_FLAG_TYPES.includes(flagType as FlagType)) {
    throw badRequest(`flagType must be one of: ${MANUAL_FLAG_TYPES.join(', ')}.`);
  }
  if (note != null && typeof note !== 'string') throw badRequest('note must be a string.');
  const type = flagType as FlagType;
  const flagNote = typeof note === 'string' && note.trim() ? note.trim() : null;
  const modelScore = await scoreFlag(db, engine, dealId, evidenceEventId, type);
  return db.transaction(async (tx) => {
    if (!await repo.findDeal(tx, dealId)) throw notFound('Deal not found.');
    if (!await repo.findEvaluation(tx, dealId)) throw conflict('Run an evaluation on this deal before adding flags.');
    if (!await repo.findAiReply(tx, dealId, evidenceEventId)) {
      throw badRequest('Only an AI reply on this deal can be flagged.');
    }
    const rule = DEFAULT_RULES[type];
    const flag = await repo.saveManualFlag(tx, dealId, evidenceEventId, type, rule.severity,
      `Flagged by the GM: ${rule.explanation}`, staff.id, flagNote, modelScore);
    if (!flag) throw conflict('This reply already has that flag.');
    return flag;
  });
}

// The GM sees every pending flag; a rep sees the ones on their own deals.
export function reviewQueue(db: Database, staff: Staff) {
  return repo.pendingFlags(db, staff.role === 'gm' ? null : staff.id);
}

// A false positive needs a reason; 'other' also needs a note saying what it was.
export async function reviewFlag(db: Database, staff: Staff, flagId: string,
  decision: unknown, note: unknown, reason?: unknown, engine?: EvaluationEngine) {
  requireGm(staff, 'review AI flags');
  if (!isReviewDecision(decision)) {
    throw badRequest(`decision must be one of: ${REVIEW_DECISIONS.join(', ')}.`);
  }
  if (note != null && typeof note !== 'string') throw badRequest('note must be a string.');
  if (reason != null && !isReviewReason(reason)) {
    throw badRequest(`reason must be one of: ${REVIEW_REASONS.join(', ')}.`);
  }
  const reviewNote = typeof note === 'string' && note.trim() ? note.trim() : null;
  const reviewReason = decision === 'false_positive' ? reason ?? null : null;
  const target = await repo.flagTarget(db, flagId);
  const modelScore = target ? await scoreFlag(db, engine, target.dealId, target.evidenceEventId, target.flagType) : null;
  return db.transaction(async (tx) => {
    const flag = await repo.lockFlag(tx, flagId);
    if (!flag) throw notFound('AI flag not found.');
    if (!isAllowedReview(flag.reviewStatus, decision)) {
      throw conflict(`A ${flag.reviewStatus} flag cannot be marked ${decision}.`);
    }
    if (decision === 'false_positive' && !reviewReason) throw badRequest('Choose why this flag is a false positive.');
    if (reviewReason === 'other' && !reviewNote) throw badRequest('Add a note saying why this flag is a false positive.');
    return repo.saveReview(tx, flag, staff.id, decision, reviewNote, reviewReason, modelScore);
  });
}

// GM summary metric "AI conversations flagged" (brief section 5).
export async function evaluationMetrics(db: Database, staff: Staff) {
  requireGm(staff, 'view store-wide AI metrics');
  const counts = await repo.evaluationCounts(db);
  const realProblems = counts.confirmedIssue + counts.resolved;
  return {
    evaluatedConversations: counts.evaluated,
    flaggedConversations: counts.flagged,
    flagRate: ratio(counts.flagged, counts.evaluated),
    flags: {
      pending: counts.pending,
      confirmedIssue: counts.confirmedIssue,
      falsePositive: counts.falsePositive,
      resolved: counts.resolved,
    },
    // Of the evaluator's flags a GM has judged, the share that were real problems.
    reviewedPrecision: ratio(realProblems, realProblems + counts.falsePositive),
    falsePositiveReasons: {
      misreadWording: counts.misreadWording,
      alreadyHandled: counts.alreadyHandled,
      visitConfirmed: counts.visitConfirmed,
      notAProblem: counts.notAProblem,
      other: counts.other,
    },
    // Problems a GM found on replies the evaluator did not flag.
    missedFlagsAddedByManager: counts.manual,
  };
}

// The model's probability for the flag's wording signal, on the message that
// signal reads: the flagged AI reply, or the one buyer message it answered.
// Null for the rules, for a turn with several buyer messages, or if the model
// is unavailable: scoring must never block a GM's review.
async function scoreFlag(db: Database, engine: EvaluationEngine | undefined, dealId: string,
  evidenceEventId: string, flagType: FlagType): Promise<number | null> {
  const mapping = FLAG_SIGNALS.find(([type]) => type === flagType);
  if (!engine?.score || !mapping) return null;
  const [, side, signal] = mapping;
  const { events } = await repo.loadConversation(db, dealId);
  const at = events.findIndex((event) => event.id === evidenceEventId);
  if (at < 0) return null;
  let text = events[at].body;
  if (side === 'buyer') {
    const before = events.slice(0, at);
    let lastAi = before.length - 1;
    while (lastAi >= 0 && !(before[lastAi].actorType === 'ai' && before[lastAi].direction === 'outbound')) lastAi--;
    const turn = before.slice(lastAi + 1).filter((e) => e.actorType === 'buyer' && e.direction === 'inbound');
    if (turn.length !== 1) return null;
    text = turn[0].body;
  }
  try {
    const value = (await engine.score(side, text))[signal];
    return typeof value === 'number' ? Math.round(value * 1000) / 1000 : null;
  } catch { return null; }
}

// Reviews that strongly disagree with the model and still need a second GM.
// A GM cannot give the second opinion on their own review.
export async function secondReviewQueue(db: Database, staff: Staff) {
  requireGm(staff, 'see reviews that need a second opinion');
  const candidates = await repo.secondReviewCandidates(db);
  return candidates
    .filter((flag) => isDisputed(reviewLabel(flag.reviewStatus, flag.reviewReason), flag.modelScore))
    .map((flag) => ({ ...flag, canReview: flag.reviewedBy !== staff.id }));
}

export async function secondReviewFlag(db: Database, staff: Staff, flagId: string, decision: unknown) {
  requireGm(staff, 'give a second opinion');
  if (!isSecondReview(decision)) throw badRequest(`decision must be one of: ${SECOND_REVIEWS.join(', ')}.`);
  return db.transaction(async (tx) => {
    const flag = await repo.lockFlag(tx, flagId);
    if (!flag) throw notFound('AI flag not found.');
    if (!isDisputed(reviewLabel(flag.reviewStatus, flag.reviewReason), flag.modelScore)) {
      throw conflict('This review does not need a second opinion.');
    }
    if (flag.secondReview) throw conflict('This review already has a second opinion.');
    if (flag.reviewedBy === staff.id) throw conflict('A different GM must give the second opinion.');
    return repo.saveSecondReview(tx, flag, staff.id, decision);
  });
}
