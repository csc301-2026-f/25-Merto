import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createLocalModelEngine } from '../src/evaluation/model-engine.ts';
import type { EvaluationEngine } from '../src/evaluation/engine.ts';
import type { Conversation, TimelineEvent } from '../src/evaluation/detect.ts';
import { DEALS, EVENTS, STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

const metadata = {
  ready: true,
  engine: { mode: 'model', name: 'Test model', version: 'test-v3', ready: true },
  signals: {
    ai: ['claims_booking', 'guarantees_availability', 'quotes_price', 'off_tone'],
    buyer: ['asks_for_person', 'asks_about_price'],
  },
  thresholds: { ai: [0.8, 0.6, 0.7, 0.9], buyer: [0.5, 0.7] },
};
let server: Server;
let engine: EvaluationEngine;
let url: string;
let failure = '';
let requests: any[] = [];
let targets: string[] = [];

before(async () => {
  server = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    const target = new URL(req.url!, 'http://localhost');
    targets.push(target.pathname + target.search);
    const selectedModel = target.searchParams.get('model');
    const selectedEngine = selectedModel ? { ...metadata.engine, id: selectedModel, name: selectedModel + ' test' } : metadata.engine;
    if (target.pathname === '/health') return void res.end(JSON.stringify({ ...metadata, engine: selectedEngine }));
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(data);
    if (failure === 'unavailable') { res.statusCode = 503; return void res.end('{}'); }
    if (failure === 'slow') await new Promise(resolve => setTimeout(resolve, 100));
    const predictions = data.messages.map((m: any) => ({
      id: m.id, side: m.side,
      signals: Object.fromEntries(metadata.signals[m.side as 'ai' | 'buyer'].map(signal =>
        [signal, m.text.startsWith('semantic') ? 0.95 : m.text === 'threshold' ? 0.65 : 0.05])),
    }));
    if (failure === 'missing') predictions.pop();
    if (failure === 'duplicate' && predictions.length > 1) predictions[1] = predictions[0];
    if (failure === 'score') predictions[0].signals[Object.keys(predictions[0].signals)[0]] = 2;
    const response = { engine: selectedEngine, thresholds: metadata.thresholds, predictions };
    if (failure === 'version') response.engine = { ...metadata.engine, version: 'other-run' };
    res.end(JSON.stringify(response));
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  engine = await createLocalModelEngine(url);
});
after(() => { server.closeAllConnections(); server.close(); });
beforeEach(() => { failure = ''; requests = []; targets = []; });

const at = (n: number) => new Date(Date.UTC(2026, 10, 1, 12, n));
const event = (id: string, actorType: TimelineEvent['actorType'], direction: TimelineEvent['direction'], body: string, n: number): TimelineEvent =>
  ({ id, actorType, direction, body, eventType: 'interaction', createdAt: at(n) });
const conversation = (): Conversation => ({
  events: [event('buyer', 'buyer', 'inbound', 'semantic buyer', 0), event('reply', 'ai', 'outbound', 'semantic reply', 1)],
  appointmentConfirmedAts: [], openItemCreatedAts: [], optOutAts: [],
});

describe('model wording through the existing conversation detector', () => {
  it('pins model selection on both health and inference requests', async () => {
    for (const model of ['minilm', 'bge', 'mpnet'] as const) {
      const selected = await createLocalModelEngine(url, 30_000, model);
      assert.equal((await selected.status()).id, model);
      await selected.detect(conversation());
      assert.ok(targets.includes('/health?model=' + model));
      assert.equal(targets.at(-1), '/predict?model=' + model);
    }
  });
  it('maps all six signals to existing flag types on the correct reply', async () => {
    const issues = await engine.detect(conversation());
    assert.deepEqual(issues.map(i => i.flagType).sort(), [
      'appointment_certainty', 'unsupported_availability', 'unsupported_price', 'tone',
      'missed_escalation', 'missed_price_handoff',
    ].sort());
    assert.ok(issues.every(i => i.evidenceEventId === 'reply'));
  });

  it('respects appointment confirmation and staff/open-item takeover', async () => {
    for (const useStaff of [true, false]) {
      const c = conversation();
      c.appointmentConfirmedAts = [at(0)];
      if (useStaff) c.events.push(event('staff', 'rep', 'internal', 'Taking over', 2));
      else c.openItemCreatedAts = [at(2)];
      assert.deepEqual((await engine.detect(c)).map(i => i.flagType).sort(),
        ['unsupported_availability', 'unsupported_price', 'tone'].sort());
      assert.equal(requests.at(-1).messages.length, 2, 'Staff/internal records are not classified');
    }
  });

  it('keeps opt-out history and never ORs in the old wording rules', async () => {
    const c = conversation();
    c.events = [event('reply', 'ai', 'outbound', "You're booked! $500", 1),
      event('staff', 'rep', 'outbound', 'Hello', 2)];
    c.optOutAts = [at(0)];
    assert.deepEqual((await engine.detect(c)).map(i => [i.flagType, i.evidenceEventId]),
      [['ignored_opt_out', 'reply'], ['ignored_opt_out', 'staff']]);
  });

  it('uses per-label dev thresholds rather than a shared 0.5 cutoff', async () => {
    const c = conversation(); c.events.forEach(e => { e.body = 'threshold'; });
    assert.deepEqual((await engine.detect(c)).map(i => i.flagType).sort(),
      ['unsupported_availability', 'missed_escalation'].sort());
  });

  it('rejects missing, duplicate, invalid and wrong-version predictions without fallback', async () => {
    for (const bad of ['unavailable', 'missing', 'duplicate', 'score', 'version']) {
      failure = bad;
      await assert.rejects(async () => engine.detect(conversation()), (e: any) => e.status === 503, bad);
    }
  });

  it('bounds inference time and limits the client to a local service', async () => {
    const fastTimeout = await createLocalModelEngine(url, 10);
    failure = 'slow';
    await assert.rejects(async () => fastTimeout.detect(conversation()), (e: any) => e.status === 503);
    await assert.rejects(createLocalModelEngine('https://example.com'));
  });
});

describe('CRM API with a model evaluator', () => {
  const api = useApi({ evaluationEngine: {
    detect: c => engine.detect(c), status: () => engine.status(),
  } });

  it('authorizes before inference and exposes the active engine', async () => {
    assert.equal((await api.call(null, 'GET', '/api/ai-evaluation/engine')).status, 401);
    assert.equal((await api.call(STAFF.dana, 'POST', '/api/evaluations/run')).status, 403);
    assert.equal((await api.call(STAFF.arjun, 'GET', `/api/deals/${DEALS.maya}/evaluation/preview`)).status, 403);
    assert.equal(requests.length, 0);
    assert.deepEqual((await api.call(STAFF.karen, 'GET', '/api/ai-evaluation/engine')).body, metadata.engine);
  });

  it('uses the model for preview, save, rerun and the existing GM review flow', async () => {
    await api.db.query('update public.timeline_events set body = $1 where id = $2', ['semantic reply', EVENTS.mayaAllSet]);
    const path = `/api/deals/${DEALS.maya}/evaluation`;
    const preview = await api.call(STAFF.karen, 'GET', `${path}/preview`);
    assert.equal(preview.status, 200);
    assert.ok(preview.body.some((i: any) => i.flagType === 'unsupported_price'));
    assert.equal((await api.call(STAFF.karen, 'GET', path)).body.status, 'not_evaluated');
    const saved = await api.call(STAFF.karen, 'POST', path);
    assert.equal(saved.status, 200);
    assert.ok(saved.body.newFlags >= 4);
    assert.equal((await api.call(STAFF.karen, 'POST', path)).body.newFlags, 0);
    const record = (await api.call(STAFF.karen, 'GET', path)).body;
    const flag = record.flags.find((f: any) => f.flagType === 'unsupported_price');
    assert.equal(flag.evidenceBody, 'semantic reply');
    assert.equal((await api.call(STAFF.karen, 'POST', `/api/ai-flags/${flag.id}/review`,
      { decision: 'confirmed_issue', note: 'Reviewed model finding.' })).status, 200);
    const reviewed = (await api.call(STAFF.karen, 'GET', path)).body;
    assert.equal(reviewed.flags.find((f: any) => f.id === flag.id).reviewStatus, 'confirmed_issue');
    assert.ok(!(await api.call(STAFF.karen, 'GET', '/api/ai-flags/queue')).body.some((f: any) => f.id === flag.id));
  });

  it('returns 503 and writes no evaluation when the model fails', async () => {
    failure = 'unavailable';
    const response = await api.call(STAFF.karen, 'POST', `/api/deals/${DEALS.maya}/evaluation`);
    assert.equal(response.status, 503);
    assert.match(response.body.error, /no rules fallback/);
    assert.equal((await api.call(STAFF.karen, 'GET', `/api/deals/${DEALS.maya}/evaluation`)).body.status, 'not_evaluated');
  });
});
