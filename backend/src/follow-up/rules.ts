// Why a buyer can need a follow-up (US6). Each reason names what happened and
// since when, so a rep sees "no reply 3 days after the quote", not just a flag.
export const REASON_CODES = [
  'unanswered_message',
  'overdue_commitment',
  'quote_no_reply',
  'missed_appointment',
  'visit_no_follow_up',
  'document_overdue',
  'gone_quiet',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

// Why a deal is not on the list even if a rule matched.
export const SUPPRESSION_CODES = [
  'opted_out',
  'deal_closed',
  'appointment_upcoming',
  'callback_scheduled',
] as const;
export type SuppressionCode = (typeof SUPPRESSION_CODES)[number];

// `owed`: the buyer is waiting on us (a question, a promise). Only an opt-out or a
// closed deal hides these; an upcoming visit does not answer a question.
// `nudge`: the buyer went quiet. A booked visit or a scheduled callback already
// is the next contact, so these wait.
export type ReasonKind = 'owed' | 'nudge';

export const REASON_KINDS: Record<ReasonCode, ReasonKind> = {
  unanswered_message: 'owed',
  overdue_commitment: 'owed',
  quote_no_reply: 'nudge',
  missed_appointment: 'nudge',
  visit_no_follow_up: 'nudge',
  document_overdue: 'nudge',
  gone_quiet: 'nudge',
};

export interface FollowUpRules {
  // A buyer's message needs a person's reply within this many hours.
  replyHours: number;
  // A quote with no reply and no follow-up for this many days.
  quoteDays: number;
  // A visit (attended, missed, or cancelled) needs contact within this many hours.
  visitHours: number;
  // A buyer silent this many days since their last message gets one check-in.
  quietDays: number;
  // A staff message that gives the buyer a price: a dollar figure or a sent quote.
  quotePattern: RegExp;
}

// Thresholds follow the scenario seed (supabase/seed/seed_scenarios.sql): reps
// follow up 3 days after a quote and the day after a visit or no-show, and a
// dormant buyer gets a check-in on day 45 after their last message (F.1, F.2).
// Patterns must not use the `g` flag: RegExp.test would then keep state.
export const DEFAULT_FOLLOW_UP_RULES: FollowUpRules = {
  replyHours: 4,
  quoteDays: 3,
  visitHours: 24,
  quietDays: 45,
  quotePattern: /\$ ?\d|\b(here is|here's|attached|attaching|sent|emailed)\b[^.!?\n]{0,30}\b(quote|offer|breakdown)\b/i,
};
