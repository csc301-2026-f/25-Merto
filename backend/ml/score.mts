// Scores model signals through the real detect.ts, next to the current rules.
// Each flag's `says()` check is swapped for a lookup of the model's probability for
// that exact text; the context logic in detectIssues is untouched.
// Usage: tsx score.mts <predictions.json> [--split test] [--threshold 0.5] [--errors]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectIssues, type Conversation, type TimelineEvent } from '../src/evaluation/detect.ts';
import * as repo from '../src/evaluation/repository.ts';
import { DEFAULT_RULES, FLAG_TYPES, type FlagType, type RuleSet } from '../src/evaluation/rules.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';

const FIXTURES = fileURLToPath(new URL('../test/fixtures/', import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const preds = JSON.parse(readFileSync(args[0], 'utf8'));
const split = flag('--split', 'test');
// --threshold overrides every signal; otherwise use the per-signal thresholds the
// training script picked on its validation rows, or 0.5.
const fixedThreshold = args.includes('--threshold') ? Number(flag('--threshold', '0.5')) : null;
const thresholdFor = (side: 'ai' | 'buyer', index: number): number =>
  fixedThreshold ?? preds.meta.thresholds?.[side]?.[index] ?? 0.5;
const threshold = fixedThreshold ?? (preds.meta.thresholds ? 'per-signal (from validation)' : 0.5);
const showErrors = args.includes('--errors');

const snippets = JSON.parse(readFileSync(`${FIXTURES}eval-snippets.json`, 'utf8')).snippets;
const scenarios = JSON.parse(readFileSync(`${FIXTURES}scenario-labels.json`, 'utf8'));

const FLAG_SIGNAL: Partial<Record<FlagType, ['ai' | 'buyer', string]>> = {
  appointment_certainty: ['ai', 'claims_booking'],
  unsupported_availability: ['ai', 'guarantees_availability'],
  unsupported_price: ['ai', 'quotes_price'],
  tone: ['ai', 'off_tone'],
  missed_escalation: ['buyer', 'asks_for_person'],
  missed_price_handoff: ['buyer', 'asks_about_price'],
};

type Mode = 'rules' | 'model' | 'hybrid';
function ruleSet(mode: Mode): RuleSet {
  if (mode === 'rules') return DEFAULT_RULES;
  const rules: RuleSet = { ignored_opt_out: DEFAULT_RULES.ignored_opt_out };
  for (const [flagType, [side, signal]] of Object.entries(FLAG_SIGNAL) as [FlagType, ['ai' | 'buyer', string]][]) {
    const base = DEFAULT_RULES[flagType];
    const index = preds.meta[`${side}_signals`].indexOf(signal);
    const ruleSays = (body: string) => base.pattern!.test(body)
      && (!base.requires || base.requires.test(body)) && !base.unless?.test(body);
    const modelSays = (body: string) => {
      const p = preds[side][body];
      if (!p) throw new Error(`no ${side} prediction for: ${body}`);
      return p[index] >= thresholdFor(side, index);
    };
    const test = mode === 'hybrid' ? (body: string) => ruleSays(body) || modelSays(body) : modelSays;
    rules[flagType] = { severity: base.severity, explanation: base.explanation, pattern: { test } as unknown as RegExp };
  }
  return rules;
}

function snippetConversation(snippet: any): Conversation {
  const start = Date.parse('2026-10-01T15:00:00Z');
  const at = (minute: number) => new Date(start + minute * 60_000);
  const events: TimelineEvent[] = [];
  if (snippet.buyer !== null) {
    events.push({ id: `${snippet.id}:buyer`, eventType: 'interaction', actorType: 'buyer',
      direction: 'inbound', body: snippet.buyer, createdAt: at(0) });
  }
  events.push({ id: `${snippet.id}:ai`, eventType: 'interaction', actorType: 'ai',
    direction: 'outbound', body: snippet.ai, createdAt: at(1) });
  return {
    events,
    appointmentConfirmedAts: snippet.context.visit_confirmed_before_reply ? [at(0)] : [],
    openItemCreatedAts: snippet.context.staff_took_over ? [at(2)] : [],
    optOutAts: [],
  };
}

const MODES: Mode[] = ['rules', 'model', 'hybrid'];
const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`);

function printTable(title: string, expected: Set<string>, detected: Record<Mode, Set<string>>, text: (key: string) => string) {
  console.log(`\n${title}`);
  console.log(`  ${'flag type'.padEnd(26)} ${'exp'.padStart(3)}   ${MODES.map((m) => `${m} R / P`.padStart(15)).join('  ')}`);
  const row = (name: string, keep: (key: string) => boolean) => {
    const exp = [...expected].filter(keep);
    if (exp.length === 0 && name === 'ignored_opt_out') return;
    const cells = MODES.map((mode) => {
      const det = [...detected[mode]].filter(keep);
      const caught = exp.filter((key) => detected[mode].has(key)).length;
      return `${pct(caught, exp.length).padStart(4)} / ${pct(caught, det.length).padStart(4)}`.padStart(15);
    });
    console.log(`  ${name.padEnd(26)} ${String(exp.length).padStart(3)}   ${cells.join('  ')}`);
  };
  FLAG_TYPES.forEach((flagType) => row(flagType, (key) => key.endsWith(`|${flagType}`)));
  row('all', () => true);
  if (!showErrors) return;
  for (const mode of ['model', 'hybrid'] as const) {
    console.log(`  ${mode} missed:`);
    [...expected].filter((key) => !detected[mode].has(key)).forEach((key) => console.log(`    ${key.split('|')[1].padEnd(25)} ${text(key)}`));
    console.log(`  ${mode} false positives:`);
    [...detected[mode]].filter((key) => !expected.has(key)).forEach((key) => console.log(`    ${key.split('|')[1].padEnd(25)} ${text(key)}`));
  }
}

const rules = Object.fromEntries(MODES.map((mode) => [mode, ruleSet(mode)])) as Record<Mode, RuleSet>;
const chosen = snippets.filter((s: any) => split === 'all' || s.split === split);
const snippetText = new Map(chosen.map((s: any) => [`${s.id}:ai`,
  `${s.id} [${s.hard_case ?? '-'}] ${s.buyer ? `buyer: "${s.buyer}" → ` : ''}ai: "${s.ai}"`]));
console.log(`predictions: ${preds.meta.body}, seed ${preds.meta.seed}, threshold ${threshold}`);
for (const difficulty of ['easy', 'hard']) {
  const group = chosen.filter((s: any) => s.difficulty === difficulty);
  const expected = new Set<string>(group.flatMap((s: any) => s.expected_flags.map((f: string) => `${s.id}:ai|${f}`)));
  const detected = Object.fromEntries(MODES.map((mode) => [mode, new Set(group.flatMap((s: any) =>
    detectIssues(snippetConversation(s), rules[mode]).map((i) => `${i.evidenceEventId}|${i.flagType}`)))])) as Record<Mode, Set<string>>;
  printTable(`Snippets: ${split} split, ${difficulty} (${group.length})`, expected, detected,
    (key) => String(snippetText.get(key.split('|')[0]) ?? key));
}

const db = await sandboxDatabase();
try {
  const expected = new Set<string>(scenarios.messages.flatMap((m: any) => m.expected_flags.map((f: string) => `${m.event_id}|${f}`)));
  const detected = Object.fromEntries(MODES.map((mode) => [mode, new Set<string>()])) as Record<Mode, Set<string>>;
  const bodies = new Map<string, string>();
  for (const { deal_id: dealId } of scenarios.deals) {
    const conversation = await repo.loadConversation(db, dealId);
    conversation.events.forEach((e) => bodies.set(e.id, e.body));
    for (const mode of MODES) {
      detectIssues(conversation, rules[mode]).forEach((i) => detected[mode].add(`${i.evidenceEventId}|${i.flagType}`));
    }
  }
  printTable(`Scenario deals (${scenarios.deals.length})`, expected, detected, (key) => `"${bodies.get(key.split('|')[0])}"`);
} finally {
  await db.close();
}
