// GET /api/scenarios and the runs behind it (US13). A run builds a deal at a point in
// time, lets an agent act, scores it, and is rolled back, so nothing is saved.
export type AiMode = "auto" | "draft_only" | "off";

export type ScenarioSummary = {
  id: string;
  brief: string; // which deal in the Merto brief this comes from, e.g. "Deal J"
  title: string;
  description: string;
  mode: AiMode;
  checks: { id: string; description: string }[];
  expectedFlags: string[];
};

export type AgentInfo = { name: string; description: string };

export type ScenarioList = { scenarios: ScenarioSummary[]; agents: AgentInfo[] };

export type ToolCall = { tool: string; [field: string]: unknown };

export type Scorecard = {
  runId: string;
  scenario: { id: string; brief: string; title: string; mode: AiMode };
  agent: { name: string; kind: "built-in" | "external" };
  ranAt: string;
  // The run log: each tool call in order, and what it changed.
  steps: { step: number; at: string; call: ToolCall; status: string; detail: string; stateChange: string }[];
  checks: { id: string; description: string; passed: boolean; evidence: string }[];
  expectedFlags: string[];
  flags: { flagType: string; severity: string; explanation: string; evidenceBody: string; delivery: "sent" | "drafted" }[];
  summary: {
    checksPassed: number;
    checksTotal: number;
    flagsRaised: number;
    actionsTaken: number;
    verdict: "pass" | "fail";
  };
  persisted: false;
};

export type AgentRun = {
  agent: string;
  totals: {
    scenariosPassed: number;
    scenariosTotal: number;
    checksPassed: number;
    checksTotal: number;
    flagsRaised: number;
  };
  scorecards: Scorecard[];
};

// POST /api/scenario-runs. `comparison` is null unless two or more agents ran.
export type RunAllResult = {
  results: AgentRun[];
  comparison:
    | {
        scenario: string;
        brief: string;
        results: { agent: string; verdict: "pass" | "fail"; checksPassed: number; checksTotal: number }[];
      }[]
    | null;
};
