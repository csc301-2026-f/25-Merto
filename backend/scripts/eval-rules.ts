// Scores the deterministic rules against the labelled datasets in test/fixtures:
// short snippets (eval-snippets.json) and full seeded deals (scenario-labels.json).
// Usage: npm run eval:rules [-- --split dev|test|all] [-- --errors]
// Tune rules on the dev split only; report the test split.
import { readFileSync } from 'node:fs';
import { detectIssues, type Conversation, type TimelineEvent } from '../src/evaluation/detect.ts';
import * as repo from '../src/evaluation/repository.ts';
import { FLAG_TYPES, type FlagType } from '../src/evaluation/rules.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';

interface Snippet {
  id: string;
  split: 'dev' | 'test';
  difficulty: 'easy' | 'hard';
  buyer: string | null;
  ai: string;
  context: { visit_confirmed_before_reply: boolean; staff_took_over: boolean };
  signals: {
    buyer: { asks_for_person: boolean; asks_about_price: boolean } | null;
    ai: { claims_booking: boolean; guarantees_availability: boolean; quotes_price: boolean; off_tone: boolean };
  };
  expected_flags: FlagType[];
}

interface ScenarioLabels {
  deals: { deal_id: string }[];
  messages: { event_id: string; expected_flags: FlagType[] }[];
}

// "messageId|flagType" identifies one flag on one message.
type FlagKey = string;

const args = process.argv.slice(2);
const split = args.includes('--split') ? args[args.indexOf('--split') + 1] : 'test';
const showErrors = args.includes('--errors');
if (!['dev', 'test', 'all'].includes(split)) throw new Error('--split must be dev, test, or all');

const fixtures = new URL('../test/fixtures/', import.meta.url);
const readJson = <T>(name: string): T => JSON.parse(readFileSync(new URL(name, fixtures), 'utf8'));
const snippets = readJson<{ snippets: Snippet[] }>('eval-snippets.json').snippets;
const scenarios = readJson<ScenarioLabels>('scenario-labels.json');

// The flags a snippet's labelled signals imply, using the brief's definitions.
function impliedFlags({ signals, context }: Snippet): FlagType[] {
  const implied: FlagType[] = [];
  if (signals.ai.claims_booking && !context.visit_confirmed_before_reply) implied.push('appointment_certainty');
  if (signals.ai.guarantees_availability) implied.push('unsupported_availability');
  if (signals.ai.quotes_price) implied.push('unsupported_price');
  if (signals.ai.off_tone) implied.push('tone');
  if (signals.buyer?.asks_for_person && !context.staff_took_over) implied.push('missed_escalation');
  if (signals.buyer?.asks_about_price && !context.staff_took_over) implied.push('missed_price_handoff');
  return implied;
}

// A snippet as a two-message conversation, so it runs through the real detector.
function snippetConversation(snippet: Snippet): Conversation {
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

const keysOf = (messageId: string, flags: readonly string[]) => flags.map((flag) => `${messageId}|${flag}`);
const percent = (part: number, whole: number) => (whole === 0 ? '   —' : `${Math.round((part / whole) * 100)}%`.padStart(4));

function printScores(title: string, expected: Set<FlagKey>, detected: Set<FlagKey>,
  text: (key: FlagKey) => string) {
  console.log(`\n${title}`);
  console.log('  flag type                  expected  caught  missed  false+  recall  precision');
  for (const flagType of FLAG_TYPES) {
    if (flagType === 'ignored_opt_out' && ![...expected].some((key) => key.endsWith('|ignored_opt_out'))) continue;
    const ofType = (keys: Set<FlagKey>) => [...keys].filter((key) => key.endsWith(`|${flagType}`));
    const exp = ofType(expected);
    const det = ofType(detected);
    const caught = exp.filter((key) => detected.has(key)).length;
    console.log(`  ${flagType.padEnd(26)} ${String(exp.length).padStart(8)} ${String(caught).padStart(7)}`
      + ` ${String(exp.length - caught).padStart(7)} ${String(det.length - caught).padStart(7)}`
      + `    ${percent(caught, exp.length)}       ${percent(caught, det.length)}`);
  }
  const caught = [...expected].filter((key) => detected.has(key)).length;
  console.log(`  ${'all'.padEnd(26)} ${String(expected.size).padStart(8)} ${String(caught).padStart(7)}`
    + ` ${String(expected.size - caught).padStart(7)} ${String(detected.size - caught).padStart(7)}`
    + `    ${percent(caught, expected.size)}       ${percent(caught, detected.size)}`);
  if (!showErrors) return;
  const describe = (key: FlagKey) => `    ${key.split('|')[1].padEnd(25)} ${text(key)}`;
  console.log('  missed:');
  [...expected].filter((key) => !detected.has(key)).forEach((key) => console.log(describe(key)));
  console.log('  false positives:');
  [...detected].filter((key) => !expected.has(key)).forEach((key) => console.log(describe(key)));
}

// 1. Snippets: check the labels are consistent, then score each difficulty.
const ids = new Set<string>();
const labelErrors: string[] = [];
for (const snippet of snippets) {
  if (ids.has(snippet.id)) labelErrors.push(`${snippet.id}: duplicate id`);
  ids.add(snippet.id);
  const implied = impliedFlags(snippet).sort().join(',');
  if (implied !== [...snippet.expected_flags].sort().join(',')) {
    labelErrors.push(`${snippet.id}: expected_flags [${snippet.expected_flags}] but signals imply [${implied}]`);
  }
}
if (labelErrors.length > 0) {
  console.error(`eval-snippets.json has ${labelErrors.length} inconsistent label(s):`);
  labelErrors.forEach((error) => console.error(`  ${error}`));
  process.exit(1);
}

const chosen = snippets.filter((snippet) => split === 'all' || snippet.split === split);
const snippetText = new Map(chosen.map((snippet) => [`${snippet.id}:ai`,
  `${snippet.id} ${snippet.buyer ? `buyer: "${snippet.buyer}" → ` : ''}ai: "${snippet.ai}"`]));
for (const difficulty of ['easy', 'hard'] as const) {
  const group = chosen.filter((snippet) => snippet.difficulty === difficulty);
  const expected = new Set(group.flatMap((snippet) => keysOf(`${snippet.id}:ai`, snippet.expected_flags)));
  const detected = new Set(group.flatMap((snippet) => detectIssues(snippetConversation(snippet))
    .map((issue) => `${issue.evidenceEventId}|${issue.flagType}`)));
  printScores(`Snippets: ${split} split, ${difficulty} (${group.length} snippets)`, expected, detected,
    (key) => snippetText.get(key.split('|')[0]) ?? key);
}

// 2. Full seeded deals, including the checks that depend on deal history.
const db = await sandboxDatabase();
try {
  const expected = new Set(scenarios.messages.flatMap((message) => keysOf(message.event_id, message.expected_flags)));
  const detected = new Set<FlagKey>();
  const bodies = new Map<string, string>();
  for (const { deal_id: dealId } of scenarios.deals) {
    const conversation = await repo.loadConversation(db, dealId);
    conversation.events.forEach((event) => bodies.set(event.id, event.body));
    detectIssues(conversation).forEach((issue) => detected.add(`${issue.evidenceEventId}|${issue.flagType}`));
  }
  printScores(`Scenario deals: ${scenarios.deals.length} deals from seed_scenarios.sql`, expected, detected,
    (key) => `${key.slice(33, 36)} "${bodies.get(key.split('|')[0])}"`);
} finally {
  await db.close();
}
