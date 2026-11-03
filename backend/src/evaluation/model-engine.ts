// Local CPU inference supplies wording signals. detectIssues still decides
// whether deal history makes those signals an issue and names the evidence.
import { HttpError } from '../errors.ts';
import { detectIssues, type Conversation } from './detect.ts';
import type { EngineStatus, EvaluationEngine } from './engine.ts';
import { DEFAULT_RULES, type FlagType, type RuleSet } from './rules.ts';

const SIGNALS = {
  ai: ['claims_booking', 'guarantees_availability', 'quotes_price', 'off_tone'],
  buyer: ['asks_for_person', 'asks_about_price'],
} as const;
type Side = keyof typeof SIGNALS;
const FLAGS: [FlagType, Side, string][] = [
  ['appointment_certainty', 'ai', 'claims_booking'],
  ['unsupported_availability', 'ai', 'guarantees_availability'],
  ['unsupported_price', 'ai', 'quotes_price'],
  ['tone', 'ai', 'off_tone'],
  ['missed_escalation', 'buyer', 'asks_for_person'],
  ['missed_price_handoff', 'buyer', 'asks_about_price'],
];
interface ModelHealth {
  ready: true;
  engine: EngineStatus;
  signals: Record<Side, string[]>;
  thresholds: Record<Side, number[]>;
}
interface Message { id: string; side: Side; text: string }
const unavailable = () => new HttpError(503,
  'MPNet model service is unavailable. Try again later; no rules fallback was used.');
const probability = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export async function createLocalModelEngine(baseUrl: string, timeoutMs = 30_000,
  model?: 'minilm' | 'bge' | 'mpnet'): Promise<EvaluationEngine> {
  return createModelEngine(baseUrl, timeoutMs, model);
}

// Hosted inference is a separate Python function; the Node API holds no weights.
export async function createRemoteModelEngine(baseUrl: string, token: string): Promise<EvaluationEngine> {
  if (!token.trim()) throw new Error('MERTO_MODEL_TOKEN is required for hosted inference.');
  return createModelEngine(baseUrl, 90_000, 'mpnet', token);
}

async function createModelEngine(baseUrl: string, timeoutMs: number,
  model?: 'minilm' | 'bge' | 'mpnet', token?: string): Promise<EvaluationEngine> {
  const url = new URL(baseUrl);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((token ? url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)
    : url.protocol !== 'http:' || !loopback)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use a loopback HTTP URL locally, or an HTTPS model-service origin with a server token.');
  }
  async function request(path: string, body?: unknown, timeout = timeoutMs) {
    try {
      const target = new URL(path, url);
      if (model) target.searchParams.set('model', model);
      const response = await fetch(target, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw unavailable();
      return await response.json();
    } catch { throw unavailable(); }
  }
  function health(value: any): ModelHealth {
    if (value?.ready !== true || value?.engine?.mode !== 'model' || value.engine.ready !== true
      || typeof value.engine.name !== 'string' || !value.engine.name
      || typeof value.engine.version !== 'string' || !value.engine.version) throw unavailable();
    if (model && value.engine.id !== model) throw unavailable();
    for (const side of ['ai', 'buyer'] as const) {
      if (JSON.stringify(value.signals?.[side]) !== JSON.stringify(SIGNALS[side])
        || !Array.isArray(value.thresholds?.[side])
        || value.thresholds[side].length !== SIGNALS[side].length
        || !value.thresholds[side].every(probability)) throw unavailable();
    }
    return value;
  }
  // The selected encoder pair is loaded on its first use by the local service.
  const initial = health(await request('/health', undefined, model ? 30_000 : 5_000));
  const identity = (value: any) => value?.mode === initial.engine.mode
    && value?.id === initial.engine.id && value?.name === initial.engine.name && value?.version === initial.engine.version;
  const thresholds = (side: Side, signal: string) => initial.thresholds[side][(SIGNALS[side] as readonly string[]).indexOf(signal)];

  return {
    async status() {
      try {
        const current = health(await request('/health', undefined, 2_000));
        const ready = identity(current.engine)
          && JSON.stringify(current.thresholds) === JSON.stringify(initial.thresholds);
        return { ...initial.engine, ready };
      } catch { return { ...initial.engine, ready: false }; }
    },
    async detect(conversation: Conversation) {
      const messages: Message[] = conversation.events.flatMap(event => {
        const side = event.actorType === 'ai' && event.direction === 'outbound' ? 'ai'
          : event.actorType === 'buyer' && event.direction === 'inbound' ? 'buyer' : null;
        return side ? [{ id: event.id, side, text: event.body }] : [];
      });
      const scores: Record<Side, Map<string, Record<string, number>>> = { ai: new Map(), buyer: new Map() };
      for (let offset = 0; offset < messages.length; offset += 64) {
        const batch = messages.slice(offset, offset + 64);
        const result = await request('/predict', { messages: batch });
        if (!identity(result?.engine) || !Array.isArray(result.predictions)
          || result.predictions.length !== batch.length
          || JSON.stringify(result.thresholds) !== JSON.stringify(initial.thresholds)) throw unavailable();
        const expected = new Map(batch.map(message => [message.id, message]));
        for (const prediction of result.predictions) {
          const message = expected.get(prediction?.id);
          if (!message || prediction.side !== message.side
            || SIGNALS[message.side].some(signal => !probability(prediction.signals?.[signal]))) throw unavailable();
          scores[message.side].set(message.text, prediction.signals);
          expected.delete(message.id);
        }
        if (expected.size) throw unavailable();
      }
      const rules: RuleSet = { ignored_opt_out: DEFAULT_RULES.ignored_opt_out };
      for (const [flagType, side, signal] of FLAGS) {
        const base = DEFAULT_RULES[flagType];
        rules[flagType] = {
          severity: base.severity, explanation: base.explanation,
          pattern: { test(body: string) {
            const row = scores[side].get(body);
            if (!row) throw unavailable();
            return row[signal] >= thresholds(side, signal);
          } },
        };
      }
      return detectIssues(conversation, rules);
    },
  };
}
