// Deliberately separate from server.ts: never loads .env or uses DATABASE_URL.
// Hosted model configuration is handled by the separate normal entry point.
import { HttpError } from '../src/errors.ts';
import { createRemoteModelEngine } from '../src/evaluation/model-engine.ts';
import { createLocalDemoApp } from '../src/evaluation/local-demo.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';

const port = Number(process.env.MERTO_DEMO_API_PORT ?? 3001);
const modelUrl = process.env.MERTO_MODEL_URL ?? 'http://127.0.0.1:3086';
const token = process.env.MERTO_MODEL_TOKEN ?? '';
// The model service's local-only retraining endpoints (run_local.py --demo-retrain).
async function modelAdmin(path: string, body: unknown = {}) {
  const response = await fetch(new URL(path, modelUrl), {
    method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(600_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(503, value.error ?? 'The model service could not retrain.');
  return value;
}
const demo = await createLocalDemoApp({
  openDatabase: sandboxDatabase,
  modelEngine: () => createRemoteModelEngine(modelUrl, token),
  modelAdmin: { retrain: body => modelAdmin('/retrain', body), reset: () => modelAdmin('/reset') },
});
const server = demo.app.listen(port, '127.0.0.1', () => {
  console.log(`Local CRM API: http://127.0.0.1:${port} (separate sandbox per evaluator)`);
});
const stop = () => { server.closeAllConnections(); server.close(() => { void demo.close().finally(() => process.exit()); }); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
