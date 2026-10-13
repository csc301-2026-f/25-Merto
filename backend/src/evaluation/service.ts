// The evaluation action layer: the same functions serve the UI and, later, AI
// agents, and each one checks permissions itself rather than trusting the caller.
import { requireDealAccess, requireGm, type Staff } from '../auth.ts';
import type { Database, Queryable } from '../db.ts';
import { badRequest, conflict, notFound } from '../errors.ts';
import { detectIssues } from './detect.ts';
import * as repo from './repository.ts';
import { REVIEW_DECISIONS, dealReviewStatus, isAllowedReview, isReviewDecision } from './review-policy.ts';

async function accessibleDeal(db: Queryable, staff: Staff, dealId: string) {
  const deal = await repo.findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  return deal;
}

// A rate is "not measured" (null), never 0, when there is nothing to divide by.
const ratio = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100) / 100);

// Dry run: what the rules would flag right now. Writes nothing.
export async function previewDeal(db: Database, staff: Staff, dealId: string) {
  await accessibleDeal(db, staff, dealId);
  const conversation = await repo.loadConversation(db, dealId);
  const bodies = new Map(conversation.events.map((event) => [event.id, event.body]));
  return detectIssues(conversation).map((issue) => ({
    ...issue, evidenceBody: bodies.get(issue.evidenceEventId),
  }));
}

export async function evaluateDeal(db: Database, staff: Staff, dealId: string) {
  requireGm(staff, 'run AI evaluations');
  return db.transaction(async (tx) => {
    const deal = await repo.findDeal(tx, dealId);
    if (!deal) throw notFound('Deal not found.');
    const issues = detectIssues(await repo.loadConversation(tx, dealId));
    return { buyer: deal.buyer, ...await repo.saveEvaluation(tx, dealId, issues) };
  });
}

// The nightly job. Each deal is its own transaction, so one failure does not
// undo the deals evaluated before it.
export async function evaluateAllDeals(db: Database, staff: Staff) {
  requireGm(staff, 'run AI evaluations');
  const results = [];
  for (const dealId of await repo.dealIdsWithAiActivity(db)) {
    results.push(await evaluateDeal(db, staff, dealId));
  }
  return results;
}

// AI activity on the buyer record: the review state and every flag with its evidence.
export async function dealEvaluation(db: Database, staff: Staff, dealId: string) {
  const deal = await accessibleDeal(db, staff, dealId);
  const [evaluation, flags] = await Promise.all([
    repo.findEvaluation(db, dealId), repo.dealFlags(db, dealId),
  ]);
  return {
    dealId,
    buyer: deal.buyer,
    status: dealReviewStatus(evaluation !== undefined, flags.map((flag) => flag.reviewStatus)),
    evaluatedAt: evaluation?.evaluatedAt ?? null,
    flags,
  };
}

// The GM sees every pending flag; a rep sees the ones on their own deals.
export function reviewQueue(db: Database, staff: Staff) {
  return repo.pendingFlags(db, staff.role === 'gm' ? null : staff.id);
}

export async function reviewFlag(db: Database, staff: Staff, flagId: string,
  decision: unknown, note: unknown) {
  requireGm(staff, 'review AI flags');
  if (!isReviewDecision(decision)) {
    throw badRequest(`decision must be one of: ${REVIEW_DECISIONS.join(', ')}.`);
  }
  if (note != null && typeof note !== 'string') throw badRequest('note must be a string.');
  const reviewNote = typeof note === 'string' && note.trim() ? note.trim() : null;
  return db.transaction(async (tx) => {
    const flag = await repo.lockFlag(tx, flagId);
    if (!flag) throw notFound('AI flag not found.');
    if (!isAllowedReview(flag.reviewStatus, decision)) {
      throw conflict(`A ${flag.reviewStatus} flag cannot be marked ${decision}.`);
    }
    return repo.saveReview(tx, flag, staff.id, decision, reviewNote);
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
    // Of the flags a GM has judged, the share that were real problems.
    reviewedPrecision: ratio(realProblems, realProblems + counts.falsePositive),
  };
}
