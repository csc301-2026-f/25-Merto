export type Flag = {
  id: string;
  flagType: string;
  severity: "high" | "medium" | "low" | string;
  explanation: string;
  reviewStatus: string; // pending | confirmed_issue | false_positive | resolved
  reviewNote?: string | null;
  reviewReason?: ReviewReason | null; // set only while the flag is a false positive
  source?: "evaluator" | "manual"; // manual: a GM added it to a reply the evaluator missed
  evidenceEventId?: string; // the timeline entry the flag is about
  evidenceBody?: string;
  evidenceChannel?: string;
  evidenceAt?: string;
  createdAt?: string;
};

// GET /api/deals/:dealId/evaluation
export type Evaluation = {
  dealId?: string;
  buyer?: string;
  status?: string;
  evaluatedAt?: string | null;
  flags?: Flag[];
  unflaggedReplies?: AiReply[];
};

// An AI-sent reply with no flag, where a GM can add a problem the evaluator missed.
export type AiReply = {
  id: string;
  channel: string;
  body: string;
  createdAt: string;
};

// Why a flag is a false positive. Only "misread_wording" says the wording check was wrong.
export const REVIEW_REASONS = {
  misread_wording: "Misread the wording",
  already_handled: "Staff already handled it",
  visit_confirmed: "Visit was already confirmed",
  not_a_problem: "Not a problem for us",
  other: "Other (add a note)",
} as const;
export type ReviewReason = keyof typeof REVIEW_REASONS;

// Flag types a GM can add by hand; ignored_opt_out always comes from send history.
export const MANUAL_FLAG_TYPES = {
  appointment_certainty: "Promised a visit that no one confirmed",
  unsupported_availability: "Promised a car is available",
  unsupported_price: "Quoted a price or payment",
  missed_escalation: "Should have handed the buyer to a person",
  missed_price_handoff: "Should have handed a price question to a person",
  tone: "Pushy, rude or robotic tone",
} as const;
export type ManualFlagType = keyof typeof MANUAL_FLAG_TYPES;

// GET /api/ai-flags/queue
export type QueueItem = Flag & {
  dealId: string;
  buyer: string;
  ownerId: string | null;
  owner: string; // "Unassigned" when there is no owner
  stage: string;
};

export type Metrics = Record<string, unknown>;

export const DEMO_EVALUATOR_IDS = ["mpnet", "deterministic"] as const;
export type DemoEvaluatorId = (typeof DEMO_EVALUATOR_IDS)[number];
export type EvaluationSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function demoEvaluatorId(value: unknown): DemoEvaluatorId | undefined {
  return typeof value === "string" && (DEMO_EVALUATOR_IDS as readonly string[]).includes(value)
    ? value as DemoEvaluatorId : undefined;
}

// Pin a request to the model displayed by that page, rather than another tab's
// most recent selection cookie. Undefined keeps the regular deployment default.
export function evaluationRequest(id?: string): RequestInit {
  if (id === undefined) return {};
  const valid = demoEvaluatorId(id);
  if (!valid) throw new Error("Unknown evaluator.");
  return { headers: { "X-Merto-Demo-Evaluator": valid } };
}

export type EvaluationEngine = {
  id?: string;
  choices?: { id: string; name: string }[];
  mode: "rules" | "model";
  name: string;
  version?: string;
  ready: boolean;
  scope?: "local" | "hosted";
};
