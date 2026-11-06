// Starts all three local processes. No .env files or hosted databases are used.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const backend = fileURLToPath(new URL('..', import.meta.url));
const frontend = path.resolve(backend, '../mertofrontend');
const modelService = path.resolve(backend, '../model-service');
const python = process.env.MERTO_DEMO_PYTHON || (existsSync(path.join(modelService, '.venv/bin/python'))
  ? path.join(modelService, '.venv/bin/python') : path.join(backend, 'ml/.venv-v3/bin/python'));
const modelToken = randomUUID();
const ports = {
  frontend: Number(process.env.MERTO_DEMO_FRONTEND_PORT || 3000),
  api: Number(process.env.MERTO_DEMO_API_PORT || 3001),
  model: Number(process.env.MERTO_DEMO_MODEL_PORT || 3086),
};
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
  process.exit(code);
}
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
function start(label, executable, args, cwd, env = {}) {
  const child = spawn(executable, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', detached: true });
  children.push(child);
  child.on('error', error => { console.error(`${label}: ${error.message}`); stop(1); });
  child.on('exit', (code, signal) => {
    if (!stopping) { console.error(`${label} stopped (${signal || code}). Stopping the local demo.`); stop(code || 1); }
  });
}
async function available(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error(`Invalid demo port: ${port}`);
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(Error(`Port ${port} is occupied. Stop that server or choose MERTO_DEMO_*_PORT overrides.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function ready(url, token) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2_000),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  throw Error(`Timed out waiting for ${url}`);
}
try {
  if (!existsSync(python)) throw Error('Missing Python environment. See backend/ml/LOCAL_CRM_DEMO.md.');
  if (!existsSync(path.join(frontend, 'node_modules/next/dist/bin/next')))
    throw Error('Run npm ci in mertofrontend/ first.');
  if (new Set(Object.values(ports)).size !== 3) throw Error('The three demo ports must be different.');
  for (const port of Object.values(ports)) await available(port);
  const modelUrl = `http://127.0.0.1:${ports.model}`;
  await new Promise((resolve, reject) => {
    const verification = spawn(python, ['verify_weights.py'], { cwd: modelService, stdio: 'inherit' });
    verification.once('error', reject);
    verification.once('exit', code => code === 0 ? resolve() : reject(Error('Tracked MPNet weights failed verification.')));
  });
  start('Model', python, ['run_local.py', '--port', String(ports.model)], modelService, { MERTO_MODEL_TOKEN: modelToken });
  await ready(`${modelUrl}/health`, modelToken);
  start('API', process.execPath, ['--import', 'tsx', 'scripts/local-model-demo.ts'], backend, {
    MERTO_MODEL_URL: modelUrl, MERTO_MODEL_TOKEN: modelToken, MERTO_DEMO_API_PORT: String(ports.api),
  });
  await ready(`http://127.0.0.1:${ports.api}/health`);
  start('Frontend', process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(ports.frontend)], frontend, {
    BACKEND_URL: `http://127.0.0.1:${ports.api}`,
  });
  console.log(`\nOpen http://127.0.0.1:${ports.frontend}/manager/ai-review`);
  console.log('Sign in as karen / test. Select MPNet or Deterministic rules in AI Review.');
  console.log('Each evaluator has separate local results/reviews. Ctrl+C stops all three processes.');
  console.log('Restarting resets all local sandboxes.\n');
} catch (error) {
  console.error(error.message);
  stop(1);
}
