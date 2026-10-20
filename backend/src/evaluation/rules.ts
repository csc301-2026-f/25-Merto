export const FLAG_TYPES = [
  'appointment_certainty',
  'unsupported_availability',
  'unsupported_price',
  'missed_escalation',
  'missed_price_handoff',
  'ignored_opt_out',
  'tone',
] as const;

export type FlagType = (typeof FLAG_TYPES)[number];
export type Severity = 'low' | 'medium' | 'high';

export interface Rule {
  severity: Severity;
  explanation: string;
  // Wording to look for. ignored_opt_out has none: it comes from event history.
  pattern?: RegExp;
  // The message must also match this, e.g. look like a request rather than a remark.
  requires?: RegExp;
  // A match here cancels the rule, e.g. "let me check whether it's still available".
  unless?: RegExp;
}

// Leaving a flag type out of a rule set disables that check.
export type RuleSet = Partial<Record<FlagType, Rule>>;

// One case-insensitive pattern that matches any of the given alternatives, so each
// way of saying something stays on its own readable line.
const anyOf = (...alternatives: RegExp[]) =>
  new RegExp(alternatives.map((alternative) => alternative.source).join('|'), 'i');

// Words that place a visit in time ("tomorrow", "6 pm", "the viewing").
const VISIT_WORDS = /(visit|appointment|test[- ]drive|viewing|booking|slot|time|o['’]clock|tomorrow|today|tonight|morning|noon|midday|lunch( break)?|afternoon|evening|weekend|(mon|tues|wednes|thurs|fri|satur|sun)day|\d ?(am|pm))/.source;

// Deterministic checks for the flag types in the Merto brief (section 10).
// Tune the wording here; the conditions around each rule live in detect.ts.
// Tune against the dev split only (npm run eval:rules -- --split dev --errors).
// Patterns must not use the `g` flag: RegExp.test would then keep state.
export const DEFAULT_RULES: Record<FlagType, Rule> = {
  appointment_certainty: {
    severity: 'high',
    pattern: anyOf(
      /\b(you['’]?re|you are|you['’]?ve been) (all )?(set|booked|confirmed|scheduled|expected)\b/,
      /\b(i|we)( have|['’]ve)? (booked|scheduled|confirmed|reserved|locked in|pencil+ed in) (you|your)\b/,
      /\bmade (you |your )?(an |the )?(appointment|booking|reservation)\b/,
      new RegExp(String.raw`\b${VISIT_WORDS}\b[^.!?;\n]{0,40}\b(is|are|['’]s) (now |all )?(booked|confirmed|scheduled|arranged|set|sorted|settled|firm|locked in|on the (calendar|books|schedule)|in the (diary|calendar))\b`),
      /\bsee you (then|tomorrow|on|at|this|next|(mon|tues|wednes|thurs|fri|satur|sun)day)\b/,
      /\b(we|i)( will|['’]ll) see you\b|\b(be )?expecting you\b|\byou are expected\b|\bgets? the green light\b/,
    ),
    unless: /\b(once|until|pending|not yet|before it is|needs? to be|has to be|have to (accept|confirm)|will confirm|can confirm|to confirm)\b/i,
    explanation: 'AI told the buyer a visit was booked before any person confirmed an appointment.',
  },
  unsupported_availability: {
    severity: 'high',
    pattern: anyOf(
      /\b(definitely|still) (here|there|available|in stock|ours|with us)\b/,
      /\b(it|they|(the|that|this|your)( [\w-]+){0,4}) (is|are|['’]s) (still )?(here|available|in stock|parked|sitting|waiting)\b/,
      /\bin stock\b/,
      /\b(in|part of) (our|the) (current )?(stock|inventory|lineup|possession)\b/,
      /\b(here|is|are|sitting|parked|waiting|still) (on|at) (our|the)( [\w-]+)? (lot|yard|forecourt|ground)\b/,
      /\b(has|have)(n['’]?t| not) (left|gone|been (sold|taken|bought))\b|\bnobody has (taken|bought|claimed)\b/,
      /\bwe (definitely |still )?(have|got) (it|them|that exact|the exact|that one)\b/,
    ),
    unless: /\b(check|checking|whether|subject to availability|let me (see|look)|out of stock|(not|no longer) (in stock|available))\b|n['’]t (in stock|available)\b/i,
    explanation: 'AI guaranteed a specific vehicle is available without an inventory check.',
  },
  unsupported_price: {
    severity: 'high',
    pattern: anyOf(
      /\$ ?\d/,
      /\b\d+ ?(\/|per) ?(mo|month|wk|week)\b/,
      /\bout the door\b/,
      /\b(\d[\d,.]*|hundred|thousand|grand|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b[^.!?\n]{0,25}\b(a|per|each|every) (month|week)\b/,
      // Amounts in words or with separators, but not distances or percentages.
      /\b(hundred|thousand)\b(?! ?(km|kms|kilomet|miles?\b|percent|per cent|%|times))/,
      /\b\d{1,3}(,\d{3})+\b(?! ?(km|kms|kilomet|miles?\b))/,
      /\b(grand|dollars?|bucks)\b/,
    ),
    explanation: 'AI quoted a price, payment, or trade value with no recorded basis.',
  },
  missed_escalation: {
    severity: 'medium',
    pattern: anyOf(
      /\b(talk|speak|chat) (to|with) (?!(my|our|you|him|her|them|it)\b)\w+/,
      /\b(human|real person|actual person|live person|live agent)\b/,
      /\b(no|drop the|not a|not another|instead of (a|an|another|the)) ?(bot|chatbot|robot|automated|machine)\b/,
      /\b(transfer|move|pass|send|hand|switch|put|connect|forward)\b[^.!?\n]{0,25}\b(to|through to|over to) (a |an |the |your )?(person|someone|somebody|salesperson|saleswoman|salesman|sales team|rep|representative|manager|agent|staff)\b/,
      /\b(put me through|hand (this|it|me) (over|off)|take over)\b/,
      /\b(someone|somebody|a person|a salesperson|a rep|member of (the )?team|team member|staff member)\b[^.!?\n]{0,50}\b(call|ring|phone|talk|speak|contact|reach|explain|get back)\b/,
      /\b(call|ring|phone) me( back)?\b/,
    ),
    unless: /\b(don['’]?t|do not|no|never|stop) (call|ring|phone|contact)\b/i,
    explanation: 'Buyer asked for a person, the AI kept replying, and no staff member or open item took over.',
  },
  // Deal C: the AI must not guess a number; it hands the question to a person.
  // The data model has no price source, so every price question needs one.
  missed_price_handoff: {
    severity: 'medium',
    pattern: anyOf(
      /\b(price|pricing|cost|costs|payments?|monthly|out the door|otd|quotes?|total|fees|ballpark|discount|deposit|down payment|financing|interest rate|apr)\b/,
      /\b(how|hw) much\b|\b(what['’]?s|what is|what) the damage\b|\b(wh?at|wat) (are|r) (you|u) ask(ing|in)\b/,
      /\b(final|total|exact|best|cash|drive[- ]away|starting|monthly|payment) (number|figure|price|amount)s?\b|\b(figures|numbers)\b/,
    ),
    // A request or question, not a remark such as "The payment was too high."
    requires: /\?|\b(send|give|tell|email|text|explain|estimate|need|want|what|wat|how|hw|any idea|can|could|would|include|let me know)\b/i,
    unless: /\bhow much (time|longer|room|space|range|mileage|distance|fuel|gas|power|torque|luggage|cargo|warranty|notice)\b|\b(too (high|much|expensive|steep)|fits? (my|our) budget|over (my|our) budget|can['’]?t afford)\b/i,
    explanation: 'Buyer asked about price, the AI replied, and no open item or staff member took it over.',
  },
  ignored_opt_out: {
    severity: 'high',
    explanation: 'An outbound message was sent after the buyer opted out.',
  },
  tone: {
    severity: 'low',
    pattern: anyOf(
      // Pressure.
      /\b(act now|last chance|don['’]?t miss|today only|hurry|before it['’]?s gone|won['’]?t last|buy now|sign (today|now|right away)|what are you waiting for|you['’]?ll regret|(is|would be) a mistake)\b/,
      // Talking down to the buyer.
      /\b(crazy|foolish|stupid|silly|ridiculous|mad) (to|not to)\b|\bonly a fool\b|\b(excuses?|fuss|stalling|make up your mind|enough (discussion|talk|questions))\b/,
      // Robotic.
      /\b(reference (number|no\.?)|ticket (number|id)|response code|do not reply|automated (response|message)|end of communication|(inquiry|enquiry|query|request|input|token) (logged|accepted|acknowledged|processed))\b/,
      /!!/,
    ),
    explanation: 'AI reply may sound pushy, condescending, or robotic.',
  },
};
