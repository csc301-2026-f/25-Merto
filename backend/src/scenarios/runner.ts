// Runs one scenario in a sandbox (US13). The deal is built inside a database transaction,
// the agent acts on it, the checks score the result, and the transaction is rolled back,
// so nothing a run does is ever saved. That is the "reset" the brief asks for.
import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from '../db.ts';
import { conflict } from '../errors.ts';
import { detectIssues, type TimelineEvent } from '../evaluation/detect.ts';
import { loadConversation } from '../evaluation/repository.ts';
import type { FlagType } from '../evaluation/rules.ts';
import type { AgentContext } from './agents.ts';
import type { Scenario, ScenarioEvent } from './catalog.ts';
import { CHECKS, type AgentMessage, type ExecutedStep, type RaisedFlag } from './checks.ts';
import { TOOLS, executeTool, type ToolCall, type ToolWorld } from './tools.ts';

export interface Scorecard {
  runId: string;
  scenario: { id: string; brief: string; title: string; mode: string };
  agent: { name: string; kind: 'built-in' | 'external' };
  ranAt: string;
  // Every tool call in order, with what it changed (the run log).
  steps: { step: number; at: string; call: ToolCall; status: string; detail: string; stateChange: string }[];
  checks: { id: string; description: string; passed: boolean; evidence: string }[];
  expectedFlags: FlagType[];
  flags: RaisedFlag[];
  summary: {
    checksPassed: number;
    checksTotal: number;
    flagsRaised: number;
    actionsTaken: number; // tool calls that changed something or sent a message
    verdict: 'pass' | 'fail';
  };
  // Always false: the run is rolled back. Tests confirm the database is unchanged.
  persisted: false;
}

// What an agent sees: the situation, not the checks that will score it.
export function buildContext(scenario: Scenario): AgentContext {
  const shown = (event: ScenarioEvent) => ({
    actorType: event.actor, channel: event.channel, direction: event.direction, body: event.body, at: event.at,
  });
  return {
    scenario: { id: scenario.id, title: scenario.title },
    mode: scenario.mode,
    now: scenario.trigger.at,
    buyer: {
      name: scenario.buyer.name,
      preferredChannel: scenario.buyer.preferredChannel,
      optedOut: scenario.buyer.optedOut,
      hasEmail: scenario.buyer.email !== null,
      hasPhone: scenario.buyer.phone !== null,
    },
    deal: {
      vehicleInterest: scenario.deal.vehicleInterest,
      source: scenario.deal.source,
      stage: scenario.deal.stage,
      owner: scenario.deal.owner?.name ?? null,
    },
    event: shown(scenario.trigger),
    history: scenario.history.map(shown),
    tools: TOOLS,
  };
}

// Thrown to roll the transaction back while carrying the result out of it.
class SandboxReset extends Error {
  readonly scorecard: Scorecard;
  constructor(scorecard: Scorecard) {
    super('Sandbox reset');
    this.scorecard = scorecard;
  }
}

async function loadScenario(tx: Queryable, scenario: Scenario): Promise<ToolWorld & { ownerId: string | null }> {
  let ownerId: string | null = null;
  if (scenario.deal.owner) {
    const [owner] = await tx.query<{ id: string }>(
      'select id from public.staff_users where email = $1', [scenario.deal.owner.email]);
    if (!owner) throw conflict(`Scenario ${scenario.id} needs the staff member ${scenario.deal.owner.email}; load the seed data.`);
    ownerId = owner.id;
  }
  const firstAt = [...scenario.history, scenario.trigger].map((event) => event.at).sort()[0];
  const [buyer] = await tx.query<{ id: string }>(`
    insert into public.buyers (name, email, phone, preferred_channel, opted_out, created_at)
    values ($1, $2, $3, $4, $5, $6::timestamptz) returning id`,
  [scenario.buyer.name, scenario.buyer.email, scenario.buyer.phone, scenario.buyer.preferredChannel,
    scenario.buyer.optedOut, firstAt]);
  const [deal] = await tx.query<{ id: string }>(`
    insert into public.deals (buyer_id, owner_id, vehicle_interest, source, stage, created_at)
    values ($1, $2, $3, $4, $5, $6::timestamptz) returning id`,
  [buyer.id, ownerId, scenario.deal.vehicleInterest, scenario.deal.source, scenario.deal.stage, firstAt]);

  for (const event of [...scenario.history, scenario.trigger]) {
    if (event.actor === 'rep' && ownerId === null) {
      throw conflict(`Scenario ${scenario.id} has a rep event but no deal owner.`);
    }
    await tx.query(`
      insert into public.timeline_events
        (deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
    [deal.id, event.kind ?? 'interaction', event.actor, event.actor === 'rep' ? ownerId : null,
      event.channel, event.direction, event.body, event.at]);
  }
  return { dealId: deal.id, ownerId, mode: scenario.mode };
}

export interface AgentTurn {
  name: string;
  kind: 'built-in' | 'external';
  calls: ToolCall[];
}

export async function runScenario(db: Database, scenario: Scenario, turn: AgentTurn): Promise<Scorecard> {
  try {
    await db.transaction(async (tx) => {
      const world = await loadScenario(tx, scenario);

      const steps: ExecutedStep[] = [];
      const messages: AgentMessage[] = [];
      const drafts: TimelineEvent[] = [];
      const triggerAt = Date.parse(scenario.trigger.at);
      for (const [index, call] of turn.calls.entries()) {
        const at = new Date(triggerAt + (index + 1) * 60_000);
        const result = await executeTool(tx, world, call, at);
        steps.push({ step: index + 1, at, call, result });
        if (call.tool === 'send_reply' && (result.status === 'sent' || result.status === 'drafted')) {
          const eventId = result.eventId ?? `draft-${drafts.length + 1}`;
          messages.push({ eventId, channel: call.channel, body: call.body, delivery: result.status });
          if (result.status === 'drafted') {
            drafts.push({ id: eventId, eventType: 'interaction', actorType: 'ai', direction: 'outbound',
              body: call.body, createdAt: at });
          }
        }
      }

      // Judge the agent's messages with the same rules the evaluation module uses.
      // A draft counts too: a person might approve it.
      const conversation = await loadConversation(tx, world.dealId);
      conversation.events = [...conversation.events, ...drafts]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const byEvent = new Map(messages.map((message) => [message.eventId, message]));
      const flags: RaisedFlag[] = detectIssues(conversation)
        .filter((issue) => byEvent.has(issue.evidenceEventId))
        .map((issue) => {
          const message = byEvent.get(issue.evidenceEventId)!;
          return { flagType: issue.flagType, severity: issue.severity, explanation: issue.explanation,
            evidenceBody: message.body, delivery: message.delivery };
        });

      const state = { scenario, steps, messages, flags };
      const checks = scenario.checks.map((id) => {
        const check = CHECKS[id];
        if (!check) throw new Error(`Scenario ${scenario.id} names an unknown check: ${id}`);
        return { id, description: check.description, ...check.run(state) };
      });
      const checksPassed = checks.filter((check) => check.passed).length;
      throw new SandboxReset({
        runId: randomUUID(),
        scenario: { id: scenario.id, brief: scenario.brief, title: scenario.title, mode: scenario.mode },
        agent: { name: turn.name, kind: turn.kind },
        ranAt: new Date().toISOString(),
        steps: steps.map(({ step, at, call, result }) => ({
          step, at: at.toISOString(), call, status: result.status, detail: result.detail, stateChange: result.stateChange,
        })),
        checks,
        expectedFlags: scenario.expectedFlags,
        flags,
        summary: {
          checksPassed,
          checksTotal: checks.length,
          flagsRaised: flags.length,
          actionsTaken: steps.filter((step) => step.result.status !== 'blocked' && step.call.tool !== 'do_nothing').length,
          verdict: checksPassed === checks.length ? 'pass' : 'fail',
        },
        persisted: false,
      });
    });
  } catch (error) {
    if (error instanceof SandboxReset) return error.scorecard;
    throw error;
  }
  throw new Error('A scenario run must end by resetting the sandbox.');
}
