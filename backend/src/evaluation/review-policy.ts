export const REVIEW_DECISIONS = ['confirmed_issue', 'false_positive', 'resolved'] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export type ReviewStatus = 'pending' | ReviewDecision;
export type DealReviewStatus = 'not_evaluated' | 'passed' | 'flagged' | ReviewDecision;

export const isReviewDecision = (value: unknown): value is ReviewDecision =>
  REVIEW_DECISIONS.includes(value as ReviewDecision);

// Why a flag was a false positive. Only misread_wording says the wording check
// was wrong; the others say the deal's situation made the flag unnecessary.
export const REVIEW_REASONS = ['misread_wording', 'already_handled', 'visit_confirmed', 'not_a_problem', 'other'] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export const isReviewReason = (value: unknown): value is ReviewReason =>
  REVIEW_REASONS.includes(value as ReviewReason);

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

// The wording label a review gives its signal: 1 for a real problem (confirmed,
// resolved, or added by a GM), 0 for a flag dismissed as misread wording, and
// null when the review says nothing about the wording.
export function reviewLabel(status: ReviewStatus, reason: ReviewReason | null): 0 | 1 | null {
  if (status === 'confirmed_issue' || status === 'resolved') return 1;
  if (status === 'false_positive' && reason === 'misread_wording') return 0;
  return null;
}

// A review strongly disagrees with the model when the model was nearly sure of
// the opposite. Such a review trains the model only once a second GM agrees.
export const DISPUTE_THRESHOLDS = { sureIssue: 0.9, sureFine: 0.1 } as const;
export function isDisputed(label: 0 | 1 | null, modelScore: number | null): boolean {
  if (label === null || modelScore === null) return false;
  return label === 0 ? modelScore >= DISPUTE_THRESHOLDS.sureIssue : modelScore <= DISPUTE_THRESHOLDS.sureFine;
}

export const SECOND_REVIEWS = ['agree', 'disagree'] as const;
export type SecondReview = (typeof SECOND_REVIEWS)[number];
export const isSecondReview = (value: unknown): value is SecondReview =>
  SECOND_REVIEWS.includes(value as SecondReview);
