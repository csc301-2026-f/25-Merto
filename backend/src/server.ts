import { createApp } from './app.ts';
import { postgresDatabase } from './db.ts';
import { sandboxDatabase } from './sandbox-db.ts';
import { STAFF } from './seed-ids.ts';
import { configuredEvaluationContext } from './evaluation/hosted.ts';
import { modelAgentFromEnv } from './scenarios/model-agent.ts';

// Optional .env with DATABASE_URL and PORT; see .env.example.
try {
  process.loadEnvFile();
} catch {
  // No .env file: use the environment as is.
}

const port = Number(process.env.PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? postgresDatabase(databaseUrl) : await sandboxDatabase();
// Development sign-in for the frontend: on with password "test" for the sandbox,
// and against a real database only if DEV_LOGIN_PASSWORD is set.
const devLoginPassword = process.env.DEV_LOGIN_PASSWORD || (databaseUrl ? undefined : 'test');

// Live model calls for the scenario checks stay off unless SCENARIO_AI_LIVE=true and a key and model are set.
const modelAgent = modelAgentFromEnv();

createApp(db, { devLoginPassword, evaluationContext: configuredEvaluationContext(db), modelAgent }).listen(port, () => {
  console.log(`Merto backend listening on http://localhost:${port}`);
  if (modelAgent) {
    console.log(`Scenario model agent is ON: ${modelAgent.client.model}, up to ${modelAgent.maxPerHour} live runs an hour.`);
  } else if (process.env.SCENARIO_AI_LIVE === 'true') {
    console.warn('SCENARIO_AI_LIVE is true, but MODEL_AGENT_MODEL or an API key is missing, so the model agent is off.');
  }
  console.log(devLoginPassword ? 'Development sign-in is on (POST /auth/login).' : 'Development sign-in is off.');
  if (databaseUrl) return;
  console.log('No DATABASE_URL: using an in-memory sandbox loaded from supabase/migrations and seed.');
  console.log(`Try: curl -X POST -H "X-Staff-Id: ${STAFF.karen}" http://localhost:${port}/api/evaluations/run`);
});
