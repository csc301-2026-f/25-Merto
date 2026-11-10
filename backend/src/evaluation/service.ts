// The evaluation action layer: the same functions serve the UI and, later, AI
// agents, and each one checks permissions itself rather than trusting the caller.
import { requireDealAccess, requireGm, requireUuid, type Staff } from '../auth.ts';
import type { Database, Queryable } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { detectIssues } from './detect.ts';
import type { IssueDetector } from './engine.ts';
import * as repo from './repository.ts';
import {
  REVIEW_DECISIONS, REVIEW_REASONS, dealReviewStatus, isAllowedReview, isReviewDecision, isReviewReason,
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

export async function evaluateDeal(db: Database, staff: Staff, dealId: string, detect: IssueDetector = detectIssues) {
  requireGm(staff, 'run AI evaluations');
  return db.transaction(async (tx) => {
    const deal = await repo.findDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
    const issues = await detect(await repo.loadConversation(tx, dealId));
    return { buyer: deal.buyer, ...await repo.saveEvaluation(tx, dealId, issues) };
  });
}

// The nightly job. Each deal is its own transaction, so one failure does not
// undo the deals evaluated before it.
export async function evaluateAllDeals(db: Database, staff: Staff, detect: IssueDetector = detectIssues) {
  requireGm(staff, 'run AI evaluations');
  const results = [];
  for (const dealId of await repo.dealIdsWithAiActivity(db)) {
    results.push(await evaluateDeal(db, staff, dealId, detect));
  }
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
  evidenceEventId: unknown, flagType: unknown, note: unknown) {
  requireGm(staff, 'flag AI replies');
  if (typeof evidenceEventId !== 'string') throw badRequest('evidenceEventId must be a UUID.');
  requireUuid(evidenceEventId, 'evidenceEventId');
  if (!MANUAL_FLAG_TYPES.includes(flagType as FlagType)) {
    throw badRequest(`flagType must be one of: ${MANUAL_FLAG_TYPES.join(', ')}.`);
  }
  if (note != null && typeof note !== 'string') throw badRequest('note must be a string.');
  const type = flagType as FlagType;
  const flagNote = typeof note === 'string' && note.trim() ? note.trim() : null;
  return db.transaction(async (tx) => {
    if (!await repo.findDeal(tx, dealId)) throw notFound('Deal not found.');
    if (!await repo.findEvaluation(tx, dealId)) throw conflict('Run an evaluation on this deal before adding flags.');
    if (!await repo.findAiReply(tx, dealId, evidenceEventId)) {
      throw badRequest('Only an AI reply on this deal can be flagged.');
    }
    const rule = DEFAULT_RULES[type];
    const flag = await repo.saveManualFlag(tx, dealId, evidenceEventId, type, rule.severity,
      `Flagged by the GM: ${rule.explanation}`, staff.id, flagNote);
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
  decision: unknown, note: unknown, reason?: unknown) {
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
  return db.transaction(async (tx) => {
    const flag = await repo.lockFlag(tx, flagId);
    if (!flag) throw notFound('AI flag not found.');
    if (!isAllowedReview(flag.reviewStatus, decision)) {
      throw conflict(`A ${flag.reviewStatus} flag cannot be marked ${decision}.`);
    }
    if (decision === 'false_positive' && !reviewReason) throw badRequest('Choose why this flag is a false positive.');
    if (reviewReason === 'other' && !reviewNote) throw badRequest('Add a note saying why this flag is a false positive.');
    return repo.saveReview(tx, flag, staff.id, decision, reviewNote, reviewReason);
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
