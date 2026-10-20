import { DEFAULT_RULES, type FlagType, type RuleSet, type Severity } from './rules.ts';

export interface TimelineEvent {
  id: string;
  eventType: string;
  actorType: 'buyer' | 'ai' | 'rep' | 'gm' | 'system';
  direction: 'inbound' | 'outbound' | 'internal';
  body: string;
  createdAt: Date;
}

// Everything the rules need about one deal, read from the shared record.
export interface Conversation {
  events: TimelineEvent[]; // this deal, oldest first
  appointmentConfirmedAts: Date[]; // confirmed_at of this deal's appointments
  openItemCreatedAts: Date[]; // this deal's open items
  optOutAts: Date[]; // opt-out events on any of the buyer's deals
}

export interface Issue {
  evidenceEventId: string;
  flagType: FlagType;
  severity: Severity;
  explanation: string;
}

const isAiOutbound = (event: TimelineEvent) =>
  event.actorType === 'ai' && event.direction === 'outbound';

// A person confirmed some visit on this deal at or before `time`.
const visitConfirmedBy = (conversation: Conversation, time: Date) =>
  conversation.appointmentConfirmedAts.some((confirmedAt) => confirmedAt <= time);

// Staff took over after `time`: a rep/GM event (reviewing a flag does not count)
// or a new open item such as a callback.
const staffTookOverSince = (conversation: Conversation, time: Date) =>
  conversation.events.some((event) => (event.actorType === 'rep' || event.actorType === 'gm')
    && event.eventType !== 'ai_review' && event.eventType !== 'draft_review' && event.createdAt >= time)
  || conversation.openItemCreatedAts.some((createdAt) => createdAt >= time);

// Pure and synchronous: no database, clock, or network. Each issue names the
// exact message that triggered it; one message may raise several flag types.
export function detectIssues(conversation: Conversation, rules: RuleSet = DEFAULT_RULES): Issue[] {
  const issues = new Map<string, Issue>();
  const raise = (event: TimelineEvent, flagType: FlagType) => {
    const rule = rules[flagType];
    if (!rule) return;
    issues.set(`${event.id}:${flagType}`, {
      evidenceEventId: event.id, flagType, severity: rule.severity, explanation: rule.explanation,
    });
  };
  const says = (flagType: FlagType, event: TimelineEvent) => {
    const rule = rules[flagType];
    if (!rule?.pattern?.test(event.body)) return false;
    if (rule.requires && !rule.requires.test(event.body)) return false;
    return !rule.unless?.test(event.body);
  };

  // Buyer requests the AI must hand to a person rather than answer itself.
  const handoffs: [FlagType, (event: TimelineEvent) => boolean][] = [
    ['missed_escalation', (event) => says('missed_escalation', event)],
    ['missed_price_handoff', (event) => says('missed_price_handoff', event)],
  ];

  conversation.events.forEach((event, index) => {
    if (isAiOutbound(event)) {
      for (const flagType of ['unsupported_availability', 'unsupported_price', 'tone'] as const) {
        if (says(flagType, event)) raise(event, flagType);
      }
      if (says('appointment_certainty', event) && !visitConfirmedBy(conversation, event.createdAt)) {
        raise(event, 'appointment_certainty');
      }
    }

    // Any outbound counts, AI or staff: once a buyer opts out, nothing goes out.
    if (event.direction === 'outbound' && conversation.optOutAts.some((at) => at <= event.createdAt)) {
      raise(event, 'ignored_opt_out');
    }

    // The buyer asked for a person or a price: flag the AI's next reply unless
    // staff took over (a staff event or a new open item such as a quote to-do).
    if (event.actorType === 'buyer' && event.direction === 'inbound') {
      const needed = handoffs.filter(([, asks]) => asks(event)).map(([flagType]) => flagType);
      const aiReply = needed.length > 0 && conversation.events.slice(index + 1).find(isAiOutbound);
      if (aiReply && !staffTookOverSince(conversation, event.createdAt)) {
        for (const flagType of needed) raise(aiReply, flagType);
      }
    }
  });

  return [...issues.values()];
}
