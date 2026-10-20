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