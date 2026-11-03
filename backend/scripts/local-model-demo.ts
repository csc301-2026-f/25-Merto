// Deliberately separate from server.ts: never loads .env or uses DATABASE_URL.
// Running the normal deployment entry point continues to use rules.
import { createLocalModelEngine } from '../src/evaluation/model-engine.ts';
import { createLocalDemoApp } from '../src/evaluation/local-demo.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';

const port = Number(process.env.MERTO_DEMO_API_PORT ?? 3001);
const modelUrl = process.env.MERTO_MODEL_URL ?? 'http://127.0.0.1:3086';
const demo = await createLocalDemoApp({
  openDatabase: sandboxDatabase,
  modelEngine: id => createLocalModelEngine(modelUrl, 30_000, id),
});
const server = demo.app.listen(port, '127.0.0.1', () => {
  console.log(`Local CRM API: http://127.0.0.1:${port} (separate sandbox per evaluator)`);
});
const stop = () => { server.closeAllConnections(); server.close(() => { void demo.close().finally(() => process.exit()); }); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
