// A model as an agent in the scenario checks (US13). The model gets the situation and the
// store's rules in plain words and answers with tool calls; those go through the same
// validation, sandbox, and checks as any other agent. The prompt names no check and no
// expected result, so the model is tested on following the rules, not on guessing the test.
//
// Live calls are off unless SCENARIO_AI_LIVE=true and a key and model are configured, they are
// limited per hour, and the core app and its tests never need a model (tests pass a fake client).
import { HttpError } from '../errors.ts';
import { dealershipTimeZone } from '../time-zone.ts';
import type { AgentContext } from './agents.ts';
import { openAiCompatibleClient, type ChatMessage, type ModelClient, type ModelUsage } from './model-client.ts';
import { TOOLS, parseToolCalls, type ToolCall } from './tools.ts';

export const MODEL_AGENT_NAME = 'model';
// Change this when the prompt changes, so a stored answer is never read as the new prompt's.
export const PROMPT_VERSION = 'us13-agent-v2';
export const MAX_ATTEMPTS = 2;

export const SYSTEM_PROMPT = `You are the AI assistant of a car dealership. Something just happened on a deal: a buyer wrote or called, or a follow-up came due. Decide what to do.

Answer with ONLY one JSON object of the form {"actions": [ ... ]}, with at most 4 actions. Each action is one of these tools:
${TOOLS.map((tool) => `- ${tool.tool}: ${tool.description} Fields: ${JSON.stringify(tool.input)}`).join('\n')}
Every action is an object with a "tool" field naming the tool, plus that tool's fields.

Store rules:
1. Never tell a buyer a visit is booked or confirmed. A visit is only a request until a person confirms it. Record it with request_appointment, and tell the buyer that a person will confirm the visit.
2. Never promise that a vehicle is available, in stock, or still on the lot. You cannot check inventory. Hand the question to a person with create_open_item.
3. Never quote or guess a price, payment, or trade value. Hand the question to a person with create_open_item.
4. If the buyer has opted out (buyer.optedOut is true), send and draft nothing. Use do_nothing.
5. If the AI mode is "off", do not reply. Create an open item so a person picks it up.
6. Reply on the buyer's preferred channel (sms or email). Keep replies short, polite, and free of pressure and exclamation marks.
7. If the message is not from a buyer (for example a vendor or spam), do nothing.
8. Unless the buyer has opted out or the AI mode is "off", always send a short reply that acknowledges the message. When you hand a question to a person, tell the buyer that a person will follow up. When the message is a visit request, tell the buyer that a person will confirm the visit.
Dates: "now" is the time of the event, in UTC. Times a buyer mentions are local to the store (time zone ${dealershipTimeZone}), and storeUtcOffset is the store's offset from UTC at "now". Convert to UTC by subtracting that offset: UTC = local time minus offset (for example, 14:30 local with an offset of +02:00 is 12:30 UTC). Read weekdays as the next such day after "now" in store time, and give scheduledFor as an ISO 8601 UTC time ending in Z.`;

// The store's offset from UTC at a moment, such as "-05:00". Worked out here, not left to the
// model: it is exactly where models slip, especially in the days around a clock change.
export function storeUtcOffset(at: string, timeZone: string = dealershipTimeZone): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(at)).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = name.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
  return match?.[1] ? `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}` : '+00:00';
}

export function buildMessages(context: AgentContext): ChatMessage[] {
  // The tools are described in the system prompt; the scenario name would only hint at the test.
  const { tools: _tools, scenario: _scenario, ...situation } = context;
  const store = { storeTimeZone: dealershipTimeZone, storeUtcOffset: storeUtcOffset(context.now) };
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ ...store, ...situation }, null, 1) },
  ];
}

// The model answered, but not in a form we can run. It is retried once, then reported.
export class UnusableAnswerError extends HttpError {
  constructor(detail: string) {
    super(502, `The model returned an answer that could not be used (${detail}). Please retry.`);
  }
}

// Tolerates a fenced answer; needs {"actions": [...]} whose tool calls pass the usual checks.
export function parseModelAnswer(content: string): ToolCall[] {
  let parsed: any;
  try {
    parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new UnusableAnswerError('not valid JSON');
  }
  if (!parsed || !Array.isArray(parsed.actions)) throw new UnusableAnswerError('no "actions" list');
  try {
    return parseToolCalls(parsed.actions);
  } catch (error) {
    throw new UnusableAnswerError(error instanceof Error ? error.message : 'invalid tool call');
  }
}

export interface ModelAgentRun {
  calls: ToolCall[];
  model: string;
  promptVersion: string;
  usage: ModelUsage;
}

export async function runModelAgent(client: ModelClient, context: AgentContext): Promise<ModelAgentRun> {
  const usage: ModelUsage = { promptTokens: 0, completionTokens: 0 };
  let lastError: UnusableAnswerError | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await client.complete(buildMessages(context));
    usage.promptTokens += reply.usage.promptTokens;
    usage.completionTokens += reply.usage.completionTokens;
    try {
      return { calls: parseModelAnswer(reply.content), model: client.model, promptVersion: PROMPT_VERSION, usage };
    } catch (error) {
      if (!(error instanceof UnusableAnswerError)) throw error;
      lastError = error;
    }
  }
  throw lastError!;
}

// At most `max` live runs in any rolling hour, so a stuck button cannot spend the budget.
export function hourlyLimiter(max: number, now: () => number = Date.now) {
  const stamps: number[] = [];
  // Reserves `count` runs at once, or none: a batch is refused before it makes its first call.
  return (count = 1) => {
    const cutoff = now() - 3_600_000;
    while (stamps.length > 0 && stamps[0] <= cutoff) stamps.shift();
    if (stamps.length + count > max) {
      throw new HttpError(429, `Live model runs are limited to ${max} per hour${count > 1 ? `, and this needs ${count}` : ''}. Please try again later.`);
    }
    for (let i = 0; i < count; i += 1) stamps.push(now());
  };
}

export interface ModelAgentRuntime {
  client: ModelClient;
  maxPerHour: number;
  take(count?: number): void; // counts live calls (one by default), or throws 429
}

export function createModelAgentRuntime(client: ModelClient, maxPerHour: number, now?: () => number): ModelAgentRuntime {
  return { client, maxPerHour, take: hourlyLimiter(maxPerHour, now) };
}

// A server on this machine (Ollama, LM Studio, llama.cpp) needs no key.
export function isLocalUrl(url: string | undefined): boolean {
  try {
    const host = new URL(url ?? '').hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

// Off unless SCENARIO_AI_LIVE=true and a model is set, plus a key unless MODEL_AGENT_BASE_URL
// points at this machine. The key can be shared with another feature (OPENAI_API_KEY) but is
// only ever read here, on the server.
export function modelAgentFromEnv(env: NodeJS.ProcessEnv = process.env): ModelAgentRuntime | undefined {
  if (env.SCENARIO_AI_LIVE !== 'true') return undefined;
  const baseUrl = env.MODEL_AGENT_BASE_URL?.trim() || undefined;
  // `||`, not `??`: .env.example leaves MODEL_AGENT_API_KEY empty, and an empty string must fall back.
  const apiKey = env.MODEL_AGENT_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || '';
  const model = (env.MODEL_AGENT_MODEL ?? '').trim();
  if (!model || (!apiKey && !isLocalUrl(baseUrl))) return undefined;
  const reasoning = env.MODEL_AGENT_REASONING === 'true' ? true : env.MODEL_AGENT_REASONING === 'false' ? false : undefined;
  const timeoutMs = Number(env.MODEL_AGENT_TIMEOUT_MS);
  const maxPerHour = Number(env.MODEL_AGENT_MAX_PER_HOUR);
  // A fixed seed asks the provider for repeatable answers (best effort). Set MODEL_AGENT_SEED to change it.
  const seed = Number.isInteger(Number(env.MODEL_AGENT_SEED)) && env.MODEL_AGENT_SEED ? Number(env.MODEL_AGENT_SEED) : 42;
  return createModelAgentRuntime(
    openAiCompatibleClient({
      apiKey, model, baseUrl, seed, reasoning,
      ...(Number.isInteger(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
    }),
    Number.isInteger(maxPerHour) && maxPerHour > 0 ? maxPerHour : 30,
  );
}
