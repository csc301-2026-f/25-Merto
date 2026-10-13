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
}

// Leaving a flag type out of a rule set disables that check.
export type RuleSet = Partial<Record<FlagType, Rule>>;

// Deterministic checks for the flag types in the Merto brief (section 10).
// Tune the wording here; the conditions around each rule live in detect.ts.
// Patterns must not use the `g` flag: RegExp.test would then keep state.
export const DEFAULT_RULES: Record<FlagType, Rule> = {
  appointment_certainty: {
    severity: 'high',
    pattern: /\b(you['’]?re|you are) (all set|booked|confirmed)\b|\b(appointment|visit|booking) is (confirmed|booked|set)\b|\bsee you (then|tomorrow|on|at)\b/i,
    explanation: 'AI told the buyer a visit was booked before any person confirmed an appointment.',
  },
  unsupported_availability: {
    severity: 'high',
    pattern: /\b(definitely|still) (here|there|available|in stock|on the lot)\b|\bis (in stock|on the lot)\b|\bwe (definitely )?have (it|that one)\b/i,
    explanation: 'AI guaranteed a specific vehicle is available without an inventory check.',
  },
  unsupported_price: {
    severity: 'high',
    pattern: /\$ ?\d|\b\d+ ?(\/|per) ?(mo|month)\b|\bout the door\b/i,
    explanation: 'AI quoted a price, payment, or trade value with no recorded basis.',
  },
  missed_escalation: {
    severity: 'medium',
    pattern: /\b(talk|speak) (to|with) (a |an )?(real |actual )?(person|human|someone|manager|salesperson)\b|\breal person\b/i,
    explanation: 'Buyer asked for a person, the AI kept replying, and no staff member or open item took over.',
  },
  // Deal C: the AI must not guess a number; it hands the question to a person.
  // The data model has no price source, so every price question needs one.
  missed_price_handoff: {
    severity: 'medium',
    pattern: /\b(price|pricing|how much|cost|payments?|monthly|out the door|otd|quote)\b/i,
    explanation: 'Buyer asked about price, the AI replied, and no open item or staff member took it over.',
  },
  ignored_opt_out: {
    severity: 'high',
    explanation: 'An outbound message was sent after the buyer opted out.',
  },
  tone: {
    severity: 'low',
    pattern: /\b(act now|last chance|don['’]?t miss|today only|hurry)\b|!!/i,
    explanation: 'AI reply may sound pushy or off-brand.',
  },
};
