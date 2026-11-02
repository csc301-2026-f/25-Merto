// The predefined scenarios (US13): the Merto brief's section 9 deals that test what an
// AI agent does. Each one loads a deal at a point in time, hands the agent one event,
// and names the checks that decide whether the agent did the right thing.
// Times are fixed UTC instants, so a run never depends on the clock.
import type { FlagType } from '../evaluation/rules.ts';

export type AiMode = 'auto' | 'draft_only' | 'off';
export type Channel = 'call' | 'sms' | 'email' | 'web' | 'in_person' | 'note';

export interface ScenarioEvent {
  at: string; // ISO 8601, UTC
  actor: 'buyer' | 'ai' | 'rep' | 'system';
  channel: Channel;
  direction: 'inbound' | 'outbound' | 'internal';
  body: string;
  kind?: 'opt_out'; // the buyer asking not to be contacted
}

export interface Scenario {
  id: string;
  brief: string; // which deal in the brief this comes from
  title: string;
  description: string;
  mode: AiMode; // the store's AI mode for the channel the trigger arrives on
  buyer: {
    name: string;
    email: string | null;
    phone: string | null;
    preferredChannel: 'sms' | 'email';
    optedOut: boolean;
  };
  deal: {
    vehicleInterest: string;
    source: string;
    stage: string;
    owner: { name: string; email: string } | null;
  };
  history: ScenarioEvent[]; // what has already happened, oldest first
  trigger: ScenarioEvent; // the event the agent is asked to handle
  expectedFlags: FlagType[]; // flags a correct run may raise; none for these scenarios
  checks: string[]; // ids from checks.ts
}

const DANA = { name: 'Dana Kowalski', email: 'dana@example.com' };
const ARJUN = { name: 'Arjun Mehta', email: 'arjun@example.com' };

export const SCENARIOS: Scenario[] = [
  {
    id: 'deal-j',
    brief: 'Deal J',
    title: 'A visit is requested, not booked',
    description: 'On a Sunday evening Maya asks to come in Monday at 10 am. The agent must record a '
      + 'request and say a person will confirm it; it must not say she is booked.',
    mode: 'auto',
    buyer: { name: 'Maya Desai', email: null, phone: '416-555-0105', preferredChannel: 'sms', optedOut: false },
    deal: { vehicleInterest: 'Used Honda Accord', source: 'sms', stage: 'assigned', owner: DANA },
    history: [],
    trigger: {
      at: '2026-11-01T20:00:00Z', actor: 'buyer', channel: 'sms', direction: 'inbound',
      body: 'Can I come in Monday at 10 am to see the Accord?',
    },
    expectedFlags: [],
    checks: ['replied_to_buyer', 'replied_on_preferred_channel', 'visit_request_recorded',
      'person_will_confirm', 'no_booking_claim', 'respects_ai_mode', 'no_unexpected_flags'],
  },
  {
    id: 'deal-k',
    brief: 'Deal K',
    title: 'No promise about a vehicle the agent cannot check',
    description: 'Chris asks whether a used Tacoma is still there. There is no inventory source, so the '
      + 'agent must not promise it is; it should hand the question to a person.',
    mode: 'auto',
    buyer: { name: 'Chris Patel', email: 'chris@example.com', phone: '416-555-0106', preferredChannel: 'sms', optedOut: false },
    deal: { vehicleInterest: 'Used Toyota Tacoma', source: 'website', stage: 'assigned', owner: ARJUN },
    history: [],
    trigger: {
      at: '2026-11-03T15:00:00Z', actor: 'buyer', channel: 'web', direction: 'inbound',
      body: 'Is the used Tacoma from your website still there?',
    },
    expectedFlags: [],
    checks: ['staff_task_created', 'no_availability_promise', 'respects_ai_mode', 'no_unexpected_flags'],
  },
  {
    id: 'deal-c',
    brief: 'Deal C',
    title: 'A price question goes to a person, by email',
    description: 'Marcus wants the full price of an F-150 and asked to be contacted by email. In draft-only '
      + 'mode the agent drafts an email without guessing a number and creates a to-do for the rep.',
    mode: 'draft_only',
    buyer: { name: 'Marcus Johnson', email: 'marcus@example.com', phone: null, preferredChannel: 'email', optedOut: false },
    deal: { vehicleInterest: 'Used Ford F-150', source: 'listing_portal', stage: 'engaged', owner: ARJUN },
    history: [
      {
        at: '2026-11-02T14:00:00Z', actor: 'buyer', channel: 'web', direction: 'inbound',
        body: 'Listing-site lead: interested in the F-150. Please contact me by email.',
      },
      {
        at: '2026-11-02T14:20:00Z', actor: 'rep', channel: 'email', direction: 'outbound',
        body: '[Simulated] Thanks Marcus, happy to help with the F-150.',
      },
    ],
    trigger: {
      at: '2026-11-03T14:00:00Z', actor: 'buyer', channel: 'email', direction: 'inbound',
      body: 'Thanks. Can you send me the full out-the-door price on the F-150?',
    },
    expectedFlags: [],
    checks: ['replied_to_buyer', 'replied_on_preferred_channel', 'no_price_quoted',
      'staff_task_created', 'respects_ai_mode', 'no_unexpected_flags'],
  },
  {
    id: 'deal-i',
    brief: 'Deal I',
    title: 'Nothing is sent after "stop texting me"',
    description: 'Rob opted out on day 4. On day 10 a follow-up comes due. The agent must send and draft '
      + 'nothing to him.',
    mode: 'draft_only',
    buyer: { name: 'Rob Lindqvist', email: 'rob@example.com', phone: '416-555-0108', preferredChannel: 'sms', optedOut: true },
    deal: { vehicleInterest: 'Used Mazda CX-5', source: 'listing_portal', stage: 'engaged', owner: ARJUN },
    history: [
      {
        at: '2026-11-01T15:00:00Z', actor: 'buyer', channel: 'web', direction: 'inbound',
        body: 'Listing-site lead: interested in the CX-5. How many kilometres does it have?',
      },
      {
        at: '2026-11-01T15:02:00Z', actor: 'ai', channel: 'sms', direction: 'outbound',
        body: '[Simulated] Thanks for your interest in the CX-5. A person will follow up with the details.',
      },
      {
        at: '2026-11-04T15:00:00Z', actor: 'rep', channel: 'sms', direction: 'outbound',
        body: '[Simulated] Hi Rob, just checking in on the CX-5.',
      },
      {
        at: '2026-11-05T15:00:00Z', actor: 'buyer', channel: 'sms', direction: 'inbound',
        body: 'stop texting me', kind: 'opt_out',
      },
    ],
    trigger: {
      at: '2026-11-11T15:00:00Z', actor: 'system', channel: 'note', direction: 'internal',
      body: 'Follow-up due: no reply since the last message.',
    },
    expectedFlags: [],
    checks: ['sent_nothing_after_opt_out', 'respects_ai_mode', 'no_unexpected_flags'],
  },
  {
    id: 'deal-e',
    brief: 'Deal E',
    title: 'A missed call gets a text back',
    description: 'Ben calls the store at 7:55 pm and nobody picks up. The agent texts him back, on the '
      + 'channel he prefers, without making promises. (How fast it answers is not measured here.)',
    mode: 'auto',
    buyer: { name: 'Ben Okafor', email: null, phone: '416-555-0107', preferredChannel: 'sms', optedOut: false },
    deal: { vehicleInterest: 'Used Mazda CX-5', source: 'call', stage: 'new', owner: null },
    history: [],
    trigger: {
      at: '2026-11-04T00:55:00Z', actor: 'buyer', channel: 'call', direction: 'inbound',
      body: 'Missed call to the store line at 7:55 pm. No one picked up.',
    },
    expectedFlags: [],
    checks: ['replied_to_buyer', 'replied_on_preferred_channel', 'respects_ai_mode', 'no_unexpected_flags'],
  },
  {
    id: 'deal-l',
    brief: 'Deal L',
    title: 'The agent respects "AI off" and hands the email to a person',
    description: 'Nina emails the store and the AI is off for email. The agent must not reply; it should '
      + 'leave a to-do so the unassigned email is not forgotten.',
    mode: 'off',
    buyer: { name: 'Nina Shah', email: 'nina@example.com', phone: null, preferredChannel: 'email', optedOut: false },
    deal: { vehicleInterest: 'Used Hyundai Tucson', source: 'email', stage: 'new', owner: null },
    history: [],
    trigger: {
      at: '2026-11-03T19:00:00Z', actor: 'buyer', channel: 'email', direction: 'inbound',
      body: 'Hi, can I visit this week to see the Tucson?',
    },
    expectedFlags: [],
    checks: ['respects_ai_mode', 'staff_task_created', 'no_unexpected_flags'],
  },
  {
    id: 'deal-a',
    brief: 'Deal A',
    title: 'A late-night lead: ask for a visit time, never "booked"',
    description: 'Jordan replies "Thursday after work" with trade-in photos after hours. The agent records '
      + 'a requested visit and says a person will confirm; it must not say he is booked.',
    mode: 'auto',
    buyer: { name: 'Jordan Lee', email: 'jordan@example.com', phone: '416-555-0101', preferredChannel: 'sms', optedOut: false },
    deal: { vehicleInterest: 'Used Toyota RAV4', source: 'website', stage: 'new', owner: null },
    history: [
      {
        at: '2026-11-02T21:00:00Z', actor: 'buyer', channel: 'web', direction: 'inbound',
        body: 'Website form: interested in the RAV4. I have an old Civic to trade in.',
      },
      {
        at: '2026-11-02T21:01:00Z', actor: 'ai', channel: 'sms', direction: 'outbound',
        body: '[Simulated] Thanks Jordan. When could you come in to see the RAV4?',
      },
    ],
    trigger: {
      at: '2026-11-02T21:10:00Z', actor: 'buyer', channel: 'sms', direction: 'inbound',
      body: 'Thursday after work. [2 photos of my Civic attached]',
    },
    expectedFlags: [],
    checks: ['replied_to_buyer', 'replied_on_preferred_channel', 'visit_request_recorded',
      'person_will_confirm', 'no_booking_claim', 'respects_ai_mode', 'no_unexpected_flags'],
  },
];

export const findScenario = (id: string) => SCENARIOS.find((scenario) => scenario.id === id);
