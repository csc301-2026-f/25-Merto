// Records one run of the local review-learning demo, so the hosted site can
// replay it. Start a fresh local demo first (`npm run demo:model`), then run:
//   npm run demo:record-replay
// The script clicks the four demo steps in order through the local API and
// writes every response to mertofrontend/lib/review-learning-replay.json.
// Restart the local demo afterwards: the run leaves its reviews in the sandbox.
import { writeFile } from 'node:fs/promises';
import { STAFF } from '../src/seed-ids.ts';

const API = process.env.MERTO_DEMO_API_URL ?? `http://127.0.0.1:${process.env.MERTO_DEMO_API_PORT ?? 3301}`;
const OUT = new URL('../../mertofrontend/lib/review-learning-replay.json', import.meta.url);
const headers = { 'X-Staff-Id': STAFF.karen, 'X-Merto-Demo-Evaluator': 'mpnet', 'Content-Type': 'application/json' };

async function call<T>(method: 'GET' | 'POST', path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { method, headers });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
const status = () => call<{ simulated: boolean; modelVersion: string | null }>('GET', '/api/demo/review-learning');
const recheck = () => call<unknown>('POST', '/api/demo/review-learning/recheck');

const start = await status();
if (start.simulated || start.modelVersion?.includes('+gm')) {
  throw new Error('The local demo already has a run. Restart it (npm run demo:model) and record again.');
}

const simulate = await call<unknown>('POST', '/api/demo/review-learning/simulate');
const secondOpinionQueue = await call<unknown[]>('GET', '/api/ai-flags/second-review');
const afterSimulate = { status: await status(), recheck: await recheck() };

const secondOpinions = await call<unknown>('POST', '/api/demo/review-learning/second-opinions');
const afterSecondOpinions = { status: await status(), recheck: await recheck() };

const retrain = await call<unknown>('POST', '/api/demo/review-learning/retrain');
const afterRetrain = { status: await status(), recheck: await recheck() };

const replay = {
  recordedAt: new Date().toISOString(),
  start: { status: start },
  simulate, secondOpinionQueue, afterSimulate,
  secondOpinions, afterSecondOpinions,
  retrain, afterRetrain,
};
await writeFile(OUT, `${JSON.stringify(replay, null, 2)}\n`);
console.log(`Wrote ${OUT.pathname}: ${secondOpinionQueue.length} second opinions, now ${afterRetrain.status.modelVersion}.`);
