export type Flag = {
  id: string;
  flagType: string;
  severity: "high" | "medium" | "low" | string;
  explanation: string;
  reviewStatus: string; // pending | confirmed_issue | false_positive | resolved
  reviewNote?: string | null;
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
};

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
