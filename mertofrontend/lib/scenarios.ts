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

// `live` agents call a language model on every run, which the provider bills and the
// backend limits per hour, so the page never runs them by surprise.
export type AgentInfo = { name: string; description: string; live?: boolean; model?: string | null };

// Which model chose the calls, the prompt it was given, and what the call used.
export type ModelRun = {
  id: string;
  promptVersion: string;
  source: "live" | "stored";
  usage: { promptTokens: number; completionTokens: number };
};

export type ScenarioList = { scenarios: ScenarioSummary[]; agents: AgentInfo[] };

export type ToolCall = { tool: string; [field: string]: unknown };

export type Scorecard = {
  runId: string;
  scenario: { id: string; brief: string; title: string; mode: AiMode };
  agent: { name: string; kind: "built-in" | "external" | "model"; model?: ModelRun };
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
  // Scenarios with no scorecard: the live model failed or was skipped after an earlier error.
  errors: { scenario: string; brief: string; status: number | null; message: string }[];
};

// POST /api/scenario-runs. `comparison` is null unless two or more agents ran.
export type RunAllResult = {
  results: AgentRun[];
  comparison:
    | {
        scenario: string;
        brief: string;
        results: { agent: string; verdict: "pass" | "fail" | "error"; checksPassed: number; checksTotal: number }[];
      }[]
    | null;
};
