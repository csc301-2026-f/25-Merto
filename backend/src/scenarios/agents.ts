// What an agent receives and returns (US13). An agent is a function from the situation
// to tool calls; an outside agent can do the same over HTTP by reading a scenario's
// context and posting its tool calls (see backend/README.md). The two built-in agents
// use rules only: no AI model is called, so runs are repeatable and free.
import type { AiMode } from './catalog.ts';
import type { ToolCall, ToolDescription } from './tools.ts';

export interface AgentContext {
  scenario: { id: string; title: string };
  mode: AiMode;
  now: string; // when the agent acts: the trigger event's time
  buyer: { name: string; preferredChannel: 'sms' | 'email'; optedOut: boolean; hasEmail: boolean; hasPhone: boolean };
  deal: { vehicleInterest: string; source: string; stage: string; owner: string | null };
  event: { actorType: string; channel: string; direction: string; body: string; at: string };
  history: { actorType: string; channel: string; direction: string; body: string; at: string }[];
  tools: ToolDescription[];
}

export interface Agent {
  name: string;
  description: string;
  act(context: AgentContext): ToolCall[];
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// "Monday at 10 am", "Thursday after work", "tomorrow at 2:30 pm" -> the next such time,
// read in UTC. Returns null when the message names no day or no time.
export function parseVisitTime(message: string, now: string): { iso: string; label: string } | null {
  const lower = message.toLowerCase();
  const base = new Date(now);
  let days: number;
  let dayName: string;
  const weekday = WEEKDAYS.findIndex((name) => lower.includes(name));
  if (weekday >= 0) {
    days = (weekday - base.getUTCDay() + 7) % 7 || 7;
    dayName = WEEKDAYS[weekday];
  } else if (/\btomorrow\b/.test(lower)) {
    days = 1;
    dayName = WEEKDAYS[(base.getUTCDay() + 1) % 7];
  } else {
    return null;
  }

  let hour: number;
  let minute = 0;
  const clock = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/);
  if (clock) {
    hour = Number(clock[1]) % 12 + (clock[3] === 'pm' ? 12 : 0);
    minute = Number(clock[2] ?? 0);
  } else if (/after work|evening/.test(lower)) {
    hour = 18;
  } else if (/morning/.test(lower)) {
    hour = 10;
  } else if (/afternoon/.test(lower)) {
    hour = 14;
  } else {
    return null;
  }

  const at = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days, hour, minute));
  const shown = `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'am' : 'pm'}`;
  return { iso: at.toISOString(), label: `${dayName[0].toUpperCase()}${dayName.slice(1)} at ${shown}` };
}

const ASKS_PRICE = /\b(price|pricing|cost|payments?|monthly|out[- ]the[- ]door|quote|how much)\b/i;
const ASKS_AVAILABILITY = /\b(still (there|here|available)|available|in stock|on the lot)\b/i;
const MISSED_CALL = /\bmissed call\b/i;

const replyChannel = (context: AgentContext): 'email' | 'sms' => context.buyer.preferredChannel;
const firstName = (context: AgentContext) => context.buyer.name.split(' ')[0];

// Follows the brief: never says a visit is booked, never guesses a price or availability,
// hands those questions to a person, sends nothing to an opted-out buyer, and does not
// reply when AI is off.
export const carefulAgent: Agent = {
  name: 'careful',
  description: 'Rule-based agent that follows the store rules in the Merto brief.',
  act(context) {
    const { event, buyer, deal } = context;
    if (buyer.optedOut) {
      return [{ tool: 'do_nothing', reason: `${buyer.name} opted out, so nothing is sent or drafted.` }];
    }
    if (context.mode === 'off') {
      return [{ tool: 'create_open_item', type: 'callback',
        description: `Reply to ${buyer.name} (${event.channel}): AI is off for this channel.` }];
    }
    if (event.actorType === 'system') {
      return [{ tool: 'do_nothing', reason: 'A person decides this follow-up.' }];
    }
    const channel = replyChannel(context);
    if (MISSED_CALL.test(event.body)) {
      return [{ tool: 'send_reply', channel,
        body: `Sorry we missed your call. Which vehicle are you interested in, and when would you like to visit?` }];
    }
    if (ASKS_PRICE.test(event.body)) {
      return [
        { tool: 'send_reply', channel,
          body: `Thanks for asking, ${firstName(context)}. I can't give an exact figure myself, so I'm asking ${deal.owner ?? 'the team'} to send you the details.` },
        { tool: 'create_open_item', type: 'unanswered_question',
          description: `Send ${buyer.name} the price details for the ${deal.vehicleInterest}.` },
      ];
    }
    if (ASKS_AVAILABILITY.test(event.body)) {
      return [
        { tool: 'send_reply', channel,
          body: `Thanks for asking, ${firstName(context)}. I'll check with the team about the ${deal.vehicleInterest} and get back to you.` },
        { tool: 'create_open_item', type: 'callback',
          description: `Confirm whether the ${deal.vehicleInterest} is available and reply to ${buyer.name}.` },
      ];
    }
    const visit = parseVisitTime(event.body, context.now);
    if (visit) {
      return [
        { tool: 'send_reply', channel,
          body: `Thanks, ${firstName(context)}. I've noted ${visit.label}. A person will confirm your visit shortly.` },
        { tool: 'request_appointment', scheduledFor: visit.iso },
      ];
    }
    return [{ tool: 'do_nothing', reason: 'Nothing here needs an automatic reply.' }];
  },
};

// Makes the mistakes the brief warns about, so a scorecard has something to catch:
// promises a booking and a vehicle, quotes a price, ignores opt-outs and AI mode, and
// texts everyone.
export const eagerAgent: Agent = {
  name: 'eager',
  description: 'Rule-based agent that makes the mistakes the brief warns about; shows a failing scorecard.',
  act(context) {
    const { event, buyer, deal } = context;
    const send = (body: string): ToolCall => ({ tool: 'send_reply', channel: 'sms', body });
    if (event.actorType === 'system') {
      return [send(`Hi ${firstName(context)}, just checking in. Still interested in the ${deal.vehicleInterest}?`)];
    }
    if (MISSED_CALL.test(event.body)) {
      return [send('Sorry we missed your call!! Which vehicle are you interested in?')];
    }
    if (ASKS_PRICE.test(event.body)) {
      return [send(`We can do the ${deal.vehicleInterest} for $450/month, out the door!`)];
    }
    if (ASKS_AVAILABILITY.test(event.body)) {
      return [send(`Yes, it's definitely here. Come by anytime!`)];
    }
    const visit = parseVisitTime(event.body, context.now);
    if (visit) {
      return [
        send(`You're all set for ${visit.label}! See you then.`),
        { tool: 'request_appointment', scheduledFor: visit.iso },
      ];
    }
    return [send(`Thanks ${buyer.name}, we will be in touch.`)];
  },
};

export const BUILT_IN_AGENTS: Agent[] = [carefulAgent, eagerAgent];
export const findAgent = (name: string) => BUILT_IN_AGENTS.find((agent) => agent.name === name);
