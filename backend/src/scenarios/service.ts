// US13: run a predefined scenario and see whether the agent did the expected things.
// GM only. Runs write nothing (see runner.ts), so they are safe on any database.
import { requireGm, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { badRequest, notFound } from '../errors.ts';
import { BUILT_IN_AGENTS, findAgent } from './agents.ts';
import { SCENARIOS, findScenario, type Scenario } from './catalog.ts';
import { CHECKS } from './checks.ts';
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

export function listScenarios(staff: Staff) {
  requireGm(staff, 'run scenario checks');
  return {
    scenarios: SCENARIOS.map(scenarioSummary),
    agents: BUILT_IN_AGENTS.map(({ name, description }) => ({ name, description })),
  };
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

// Either a built-in agent by name, or the tool calls an outside agent chose for this
// scenario (with an optional label for the scorecard).
export async function runOne(db: Database, staff: Staff, id: string, body: Record<string, unknown>): Promise<Scorecard> {
  requireGm(staff, 'run scenario checks');
  const scenario = requireScenario(id);
  const hasAgent = body.agent !== undefined;
  const hasActions = body.actions !== undefined;
  if (hasAgent === hasActions) throw badRequest('Send either "agent" (a built-in agent) or "actions" (tool calls), not both or neither.');

  if (hasAgent) {
    const agent = typeof body.agent === 'string' ? findAgent(body.agent) : undefined;
    if (!agent) throw badRequest(`agent must be one of: ${BUILT_IN_AGENTS.map((known) => known.name).join(', ')}.`);
    return runScenario(db, scenario, { name: agent.name, kind: 'built-in', calls: agent.act(buildContext(scenario)) });
  }
  const label = body.agentName === undefined ? 'external' : body.agentName;
  if (typeof label !== 'string' || !label.trim() || label.trim().length > MAX_AGENT_NAME) {
    throw badRequest(`agentName must be text of at most ${MAX_AGENT_NAME} characters.`);
  }
  return runScenario(db, scenario, { name: label.trim(), kind: 'external', calls: parseToolCalls(body.actions) });
}

// Every scenario for each named agent, with totals per agent. With two or more agents,
// `comparison` lines their results up scenario by scenario.
export async function runAll(db: Database, staff: Staff, body: Record<string, unknown>) {
  requireGm(staff, 'run scenario checks');
  const names = body.agents ?? [BUILT_IN_AGENTS[0].name];
  if (!Array.isArray(names) || names.length === 0 || names.length > BUILT_IN_AGENTS.length
    || new Set(names).size !== names.length || !names.every((name) => typeof name === 'string' && findAgent(name))) {
    throw badRequest(`agents must list distinct built-in agents: ${BUILT_IN_AGENTS.map((known) => known.name).join(', ')}.`);
  }

  const results: AgentResult[] = [];
  for (const name of names as string[]) {
    const agent = findAgent(name)!;
    const scorecards: Scorecard[] = [];
    for (const scenario of SCENARIOS) {
      scorecards.push(await runScenario(db, scenario,
        { name: agent.name, kind: 'built-in', calls: agent.act(buildContext(scenario)) }));
    }
    results.push({
      agent: agent.name,
      totals: {
        scenariosPassed: scorecards.filter((card) => card.summary.verdict === 'pass').length,
        scenariosTotal: scorecards.length,
        checksPassed: scorecards.reduce((sum, card) => sum + card.summary.checksPassed, 0),
        checksTotal: scorecards.reduce((sum, card) => sum + card.summary.checksTotal, 0),
        flagsRaised: scorecards.reduce((sum, card) => sum + card.summary.flagsRaised, 0),
      },
      scorecards,
    });
  }

  return {
    results,
    comparison: results.length < 2 ? null : SCENARIOS.map((scenario, index) => ({
      scenario: scenario.id,
      brief: scenario.brief,
      results: results.map((result) => {
        const { verdict, checksPassed, checksTotal } = result.scorecards[index].summary;
        return { agent: result.agent, verdict, checksPassed, checksTotal };
      }),
    })),
  };
}
