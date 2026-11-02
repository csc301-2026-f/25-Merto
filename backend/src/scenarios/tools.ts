// The agent's action layer (US13): the tools an agent may call, how they are checked,
// and what each one writes to the deal. A reply obeys the store's AI mode: off blocks it,
// draft-only keeps it as a draft, auto sends it (simulated). The tools never refuse
// content (an opt-out, a price, a "you're booked"), so a bad agent shows up in the checks.
import type { Queryable } from '../db.ts';
import { badRequest } from '../errors.ts';
import { OPEN_ITEM_TYPES } from '../open-items/policy.ts';
import type { AiMode } from './catalog.ts';

export type OpenItemType = (typeof OPEN_ITEM_TYPES)[number];

export type ToolCall =
  | { tool: 'send_reply'; channel: 'email' | 'sms'; body: string }
  | { tool: 'create_open_item'; type: OpenItemType; description: string }
  | { tool: 'request_appointment'; scheduledFor: string }
  | { tool: 'do_nothing'; reason: string };

export interface ToolDescription {
  tool: ToolCall['tool'];
  description: string;
  input: Record<string, string>;
}

export const TOOLS: ToolDescription[] = [
  {
    tool: 'send_reply',
    description: 'Reply to the buyer. Sent in auto mode, kept as a draft in draft-only mode, blocked when AI is off.',
    input: { channel: 'email | sms', body: 'text, 1 to 1000 characters' },
  },
  {
    tool: 'create_open_item',
    description: 'Hand something to a person by creating a to-do on the deal, owned by the deal owner.',
    input: { type: OPEN_ITEM_TYPES.join(' | '), description: 'text, 1 to 500 characters' },
  },
  {
    tool: 'request_appointment',
    description: 'Record a requested visit. It stays requested until a person confirms it.',
    input: { scheduledFor: 'ISO 8601 date and time' },
  },
  {
    tool: 'do_nothing',
    description: 'Take no action, with the reason.',
    input: { reason: 'text, 1 to 300 characters' },
  },
];

export const MAX_ACTIONS = 10;
const MAX_BODY = 1000;
const MAX_DESCRIPTION = 500;
const MAX_REASON = 300;

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${field} is required.`);
  const clean = value.trim();
  if (clean.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return clean;
}

// Checks an agent's tool calls before anything runs, so a bad call is a 400, not a database error.
export function parseToolCalls(value: unknown): ToolCall[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('actions must be a non-empty array.');
  if (value.length > MAX_ACTIONS) throw badRequest(`actions can have at most ${MAX_ACTIONS} tool calls.`);
  return value.map((raw, index): ToolCall => {
    const at = `actions[${index}]`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw badRequest(`${at} must be an object.`);
    const call = raw as Record<string, unknown>;
    switch (call.tool) {
      case 'send_reply':
        if (call.channel !== 'email' && call.channel !== 'sms') throw badRequest(`${at}.channel must be email or sms.`);
        return { tool: 'send_reply', channel: call.channel, body: text(call.body, `${at}.body`, MAX_BODY) };
      case 'create_open_item':
        if (!(OPEN_ITEM_TYPES as readonly unknown[]).includes(call.type)) {
          throw badRequest(`${at}.type must be one of: ${OPEN_ITEM_TYPES.join(', ')}.`);
        }
        return {
          tool: 'create_open_item', type: call.type as OpenItemType,
          description: text(call.description, `${at}.description`, MAX_DESCRIPTION),
        };
      case 'request_appointment': {
        const when = text(call.scheduledFor, `${at}.scheduledFor`, 40);
        if (Number.isNaN(Date.parse(when))) throw badRequest(`${at}.scheduledFor must be a date and time.`);
        return { tool: 'request_appointment', scheduledFor: new Date(when).toISOString() };
      }
      case 'do_nothing':
        return { tool: 'do_nothing', reason: text(call.reason, `${at}.reason`, MAX_REASON) };
      default:
        throw badRequest(`${at}.tool must be one of: ${TOOLS.map((tool) => tool.tool).join(', ')}.`);
    }
  });
}

export interface ToolWorld {
  dealId: string;
  ownerId: string | null;
  mode: AiMode;
}

export interface ToolResult {
  status: 'sent' | 'drafted' | 'blocked' | 'created' | 'recorded';
  detail: string;
  stateChange: string;
  eventId: string | null; // the timeline entry written, or null when nothing was
}

// Runs one tool call at a fixed instant (a transaction has one clock, so each step
// gets its own timestamp and the timeline keeps its order).
export async function executeTool(tx: Queryable, world: ToolWorld, call: ToolCall, at: Date): Promise<ToolResult> {
  switch (call.tool) {
    case 'send_reply': {
      if (world.mode === 'off') {
        return { status: 'blocked', detail: `AI is off for this channel, so the ${call.channel} reply was not sent.`,
          stateChange: 'none', eventId: null };
      }
      if (world.mode === 'draft_only') {
        return { status: 'drafted', detail: `Kept as a ${call.channel} draft for a person to review; nothing was sent.`,
          stateChange: 'none (draft only)', eventId: null };
      }
      const [event] = await tx.query<{ id: string }>(`
        insert into public.timeline_events (deal_id, event_type, actor_type, channel, direction, body, created_at)
        values ($1, 'interaction', 'ai', $2, 'outbound', $3, $4::timestamptz) returning id`,
      [world.dealId, call.channel, call.body, at.toISOString()]);
      return { status: 'sent', detail: `Simulated ${call.channel} sent to the buyer.`,
        stateChange: 'timeline +1 (AI, outbound)', eventId: event.id };
    }
    case 'create_open_item': {
      await tx.query(`
        insert into public.open_items (deal_id, owner_id, type, description, created_at)
        values ($1, $2, $3, $4, $5::timestamptz)`,
      [world.dealId, world.ownerId, call.type, call.description, at.toISOString()]);
      return { status: 'created', detail: `Created a ${call.type.replaceAll('_', ' ')} to-do.`,
        stateChange: 'open items +1 (open)', eventId: null };
    }
    case 'request_appointment': {
      await tx.query(`
        insert into public.appointments (deal_id, scheduled_for, status)
        values ($1, $2::timestamptz, 'requested')`, [world.dealId, call.scheduledFor]);
      return { status: 'created', detail: `Recorded a visit request for ${call.scheduledFor}.`,
        stateChange: 'appointments +1 (requested, not confirmed)', eventId: null };
    }
    case 'do_nothing':
      return { status: 'recorded', detail: call.reason, stateChange: 'none', eventId: null };
  }
}
