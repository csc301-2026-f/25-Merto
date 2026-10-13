export const REVIEW_DECISIONS = ['confirmed_issue', 'false_positive', 'resolved'] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export type ReviewStatus = 'pending' | ReviewDecision;
export type DealReviewStatus = 'not_evaluated' | 'passed' | 'flagged' | ReviewDecision;

export const isReviewDecision = (value: unknown): value is ReviewDecision =>
  REVIEW_DECISIONS.includes(value as ReviewDecision);

// Decisions a GM may record from each status. A GM can correct an earlier call
// (confirmed issue <-> false positive); a resolved flag is final.
const ALLOWED_REVIEWS: Record<ReviewStatus, readonly ReviewDecision[]> = {
  pending: ['confirmed_issue', 'false_positive', 'resolved'],
  confirmed_issue: ['resolved', 'false_positive'],
  false_positive: ['confirmed_issue'],
  resolved: [],
};

export function isAllowedReview(current: ReviewStatus, decision: ReviewDecision): boolean {
  return ALLOWED_REVIEWS[current].includes(decision);
}

// The brief's AI review state for a whole deal. A deal reads as flagged while
// any flag is pending, so the GM view never hides undecided work.
export function dealReviewStatus(evaluated: boolean, flagStatuses: ReviewStatus[]): DealReviewStatus {
  if (!evaluated) return 'not_evaluated';
  if (flagStatuses.length === 0) return 'passed';
  for (const status of ['pending', 'confirmed_issue', 'resolved'] as const) {
    if (flagStatuses.includes(status)) return status === 'pending' ? 'flagged' : status;
  }
  return 'false_positive';
}
