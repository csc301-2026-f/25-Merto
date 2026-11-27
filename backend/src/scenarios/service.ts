// US13: run a predefined scenario and see whether the agent did the expected things.
// GM only. Runs write nothing (see runner.ts), so they are safe on any database.
import { requireGm, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { HttpError, badRequest, notFound } from '../errors.ts';
import { BUILT_IN_AGENTS, findAgent } from './agents.ts';
import { SCENARIOS, findScenario, type Scenario } from './catalog.ts';
import { CHECKS } from './checks.ts';
import { MODEL_AGENT_NAME, runModelAgent, type ModelAgentRuntime } from './model-agent.ts';
import { buildContext, runScenario, type Scorecard } from './runner.ts';
import { MAX_ACTIONS, TOOLS, parseToolCalls } from './tools.ts';

const MAX_AGENT_NAME = 60;

interface AgentResult {
  agent: string;
  totals: {
    scenariosPassed: number;
    scenariosTotal: number;
    checksPassed: number;
    checksTotal: number;
    flagsRaised: number;
  };
  scorecards: Scorecard[];
  // Scenarios that did not produce a scorecard (only the live model agent can fail this way).
  errors: ScenarioError[];
}

interface ScenarioError {
  scenario: string;
  brief: string;
  status: number | null;
  message: string;
}

function scenarioSummary(scenario: Scenario) {
  return {
    id: scenario.id,
    brief: scenario.brief,
    title: scenario.title,
    description: scenario.description,
    mode: scenario.mode,
    checks: scenario.checks.map((id) => ({ id, description: CHECKS[id].description })),
    expectedFlags: scenario.expectedFlags,
  };
}

function requireScenario(id: string): Scenario {
  const scenario = findScenario(id);
  if (!scenario) throw notFound('Scenario not found.');
  return scenario;
}

// The built-in agents, plus the model agent when live calls are configured. `live` tells
// the page that running it calls a model (and may cost money), so it is never run by surprise.
function agentList(runtime?: ModelAgentRuntime) {
  const builtIn = BUILT_IN_AGENTS.map(({ name, description }) => ({ name, description, live: false as boolean, model: null as string | null }));
  return runtime
    ? [...builtIn, {
      name: MODEL_AGENT_NAME,
      description: `Calls a language model (${runtime.client.model}) live, up to ${runtime.maxPerHour} runs an hour. Each run is billed by the provider.`,
      live: true,
      model: runtime.client.model,
    }]
    : builtIn;
}

const agentNames = (runtime?: ModelAgentRuntime) => agentList(runtime).map((agent) => agent.name);

export function listScenarios(staff: Staff, runtime?: ModelAgentRuntime) {
  requireGm(staff, 'run scenario checks');
  return { scenarios: SCENARIOS.map(scenarioSummary), agents: agentList(runtime) };
}

// The interface for an outside agent: the event it receives, the deal it can read, and
// the tools it may call. It returns tool calls with POST .../runs and gets a scorecard.
export function scenarioDetail(staff: Staff, id: string) {
  requireGm(staff, 'run scenario checks');
  const scenario = requireScenario(id);
  return {
    ...scenarioSummary(scenario),
    context: buildContext(scenario),
    limits: { maxActions: MAX_ACTIONS },
    tools: TOOLS,
  };
}

// One run by the model agent: ask the model, score the answer. The caller has already
// counted the call against the hourly limit (`runtime.take`).
async function runModel(db: Database, scenario: Scenario, runtime: ModelAgentRuntime): Promise<Scorecard> {
  const run = await runModelAgent(runtime.client, buildContext(scenario));
  return runScenario(db, scenario, {
    name: MODEL_AGENT_NAME,
    kind: 'model',
    calls: run.calls,
    model: { id: run.model, promptVersion: run.promptVersion, source: 'live', usage: run.usage },
  });
}

// Either an agent by name, or the tool calls an outside agent chose for this scenario
// (with an optional label for the scorecard).
export async function runOne(db: Database, staff: Staff, id: string, body: Record<string, unknown>,
  runtime?: ModelAgentRuntime): Promise<Scorecard> {
  requireGm(staff, 'run scenario checks');
  const scenario = requireScenario(id);
  const hasAgent = body.agent !== undefined;
  const hasActions = body.actions !== undefined;
  if (hasAgent === hasActions) throw badRequest('Send either "agent" (an agent by name) or "actions" (tool calls), not both or neither.');

  if (hasAgent) {
    if (body.agent === MODEL_AGENT_NAME && runtime) {
      runtime.take();
      return runModel(db, scenario, runtime);
    }
    const agent = typeof body.agent === 'string' ? findAgent(body.agent) : undefined;
    if (!agent) throw badRequest(`agent must be one of: ${agentNames(runtime).join(', ')}.`);
    return runScenario(db, scenario, { name: agent.name, kind: 'built-in', calls: agent.act(buildContext(scenario)) });
  }
  const label = body.agentName === undefined ? 'external' : body.agentName;
  if (typeof label !== 'string' || !label.trim() || label.trim().length > MAX_AGENT_NAME) {
    throw badRequest(`agentName must be text of at most ${MAX_AGENT_NAME} characters.`);
  }
  return runScenario(db, scenario, { name: label.trim(), kind: 'external', calls: parseToolCalls(body.actions) });
}

// Every scenario for each named agent, with totals per agent. With two or more agents,
// `comparison` lines their results up scenario by scenario. The model agent runs only when
// it is named, because every scenario is one live call.
export async function runAll(db: Database, staff: Staff, body: Record<string, unknown>,
  runtime?: ModelAgentRuntime) {
  requireGm(staff, 'run scenario checks');
  const available = agentNames(runtime);
  const names = body.agents ?? [BUILT_IN_AGENTS[0].name];
  if (!Array.isArray(names) || names.length === 0 || names.length > available.length
    || new Set(names).size !== names.length
    || !names.every((name) => typeof name === 'string' && available.includes(name))) {
    throw badRequest(`agents must list distinct agents: ${available.join(', ')}.`);
  }

  // Count every live call before the first one, so a run the hourly limit cannot cover is
  // refused up front instead of failing partway and losing the calls that already finished.
  if ((names as string[]).includes(MODEL_AGENT_NAME)) runtime!.take(SCENARIOS.length);

  const results: AgentResult[] = [];
  for (const name of names as string[]) {
    const scorecards: Scorecard[] = [];
    const errors: ScenarioError[] = [];
    let stoppedBy: string | null = null;
    for (const scenario of SCENARIOS) {
      if (name === MODEL_AGENT_NAME) {
        // One unusable answer (502) fails only that scenario. Any other error (key, quota,
        // timeout) will repeat, so the remaining scenarios are skipped rather than retried.
        if (stoppedBy) {
          errors.push({ scenario: scenario.id, brief: scenario.brief, status: null, message: `Not run: ${stoppedBy}` });
          continue;
        }
        try {
          scorecards.push(await runModel(db, scenario, runtime!));
        } catch (error) {
          const status = (error as { status?: number }).status ?? 500;
          const message = error instanceof HttpError ? error.message : 'The model run failed.';
          errors.push({ scenario: scenario.id, brief: scenario.brief, status, message });
          if (status !== 502) stoppedBy = message;
        }
        continue;
      }
      const agent = findAgent(name)!;
      scorecards.push(await runScenario(db, scenario,
        { name: agent.name, kind: 'built-in', calls: agent.act(buildContext(scenario)) }));
    }
    // A scenario that did not run counts as not passed, with all of its checks unmet.
    const unrun = errors.reduce((sum, item) => sum + findScenario(item.scenario)!.checks.length, 0);
    results.push({
      agent: name,
      totals: {
        scenariosPassed: scorecards.filter((card) => card.summary.verdict === 'pass').length,
        scenariosTotal: SCENARIOS.length,
        checksPassed: scorecards.reduce((sum, card) => sum + card.summary.checksPassed, 0),
        checksTotal: scorecards.reduce((sum, card) => sum + card.summary.checksTotal, 0) + unrun,
        flagsRaised: scorecards.reduce((sum, card) => sum + card.summary.flagsRaised, 0),
      },
      scorecards,
      errors,
    });
  }

  return {
    results,
    comparison: results.length < 2 ? null : SCENARIOS.map((scenario) => ({
      scenario: scenario.id,
      brief: scenario.brief,
      results: results.map((result) => {
        const card = result.scorecards.find((item) => item.scenario.id === scenario.id);
        if (!card) return { agent: result.agent, verdict: 'error' as const, checksPassed: 0, checksTotal: scenario.checks.length };
        const { verdict, checksPassed, checksTotal } = card.summary;
        return { agent: result.agent, verdict, checksPassed, checksTotal };
      }),
    })),
  };
}
