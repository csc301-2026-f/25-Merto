// Smoke test for the live model agent: runs every scenario once (or RUNS times) against whatever
// model backend/.env points at (OpenAI, Groq, or a local server) and reports, per scenario,
// whether the model returned a usable answer and whether the checks passed.
// It makes real model calls, so it is a manual script, never part of `npm test`.
//   npm run check:model
//   RUNS=3 npm run check:model
// Never prints the key.
import { sandboxDatabase } from '../src/sandbox-db.ts';
import { SCENARIOS } from '../src/scenarios/catalog.ts';
import { modelAgentFromEnv, runModelAgent } from '../src/scenarios/model-agent.ts';
import { buildContext, runScenario } from '../src/scenarios/runner.ts';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* no .env: use the shell's variables */ }
process.env.SCENARIO_AI_LIVE = 'true';

const runtime = modelAgentFromEnv();
if (!runtime) {
  console.error('The model agent is not configured. Set MODEL_AGENT_MODEL, and either a key');
  console.error('(MODEL_AGENT_API_KEY or OPENAI_API_KEY) or a local MODEL_AGENT_BASE_URL, in backend/.env.');
  process.exit(1);
}

const runs = Math.max(1, Number(process.env.RUNS) || 1);
const where = (() => { try { return new URL(process.env.MODEL_AGENT_BASE_URL || 'https://api.openai.com/v1').host; } catch { return 'unknown host'; } })();
console.log(`Model ${runtime.client.model} at ${where}; ${runs} run(s) per scenario.\n`);

const db = await sandboxDatabase();
let usable = 0;
let passed = 0;
let total = 0;
let tokens = 0;
for (const scenario of SCENARIOS) {
  let usableHere = 0;
  let passedHere = 0;
  const problems = new Map<string, number>();
  for (let i = 0; i < runs; i += 1) {
    total += 1;
    try {
      const run = await runModelAgent(runtime.client, buildContext(scenario));
      usableHere += 1;
      tokens += run.usage.promptTokens + run.usage.completionTokens;
      const card = await runScenario(db, scenario, { name: 'model', kind: 'external', calls: run.calls });
      if (card.summary.verdict === 'pass') passedHere += 1;
      else for (const check of card.checks.filter((item) => !item.passed)) problems.set(`failed ${check.id}`, (problems.get(`failed ${check.id}`) ?? 0) + 1);
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = `${status ?? 'error'}: ${error instanceof Error ? error.message : String(error)}`;
      problems.set(message, (problems.get(message) ?? 0) + 1);
    }
  }
  usable += usableHere;
  passed += passedHere;
  const detail = [...problems].map(([text, n]) => `${text}${runs > 1 ? ` x${n}` : ''}`).join('; ');
  console.log(`${scenario.id.padEnd(7)} usable ${usableHere}/${runs}  passed ${passedHere}/${runs}${detail ? `   ${detail}` : ''}`);
}
console.log(`\nUsable JSON answers: ${usable} of ${total}. Checks passed: ${passed} of ${total}. Tokens used: ${tokens}.`);
await db.close();
