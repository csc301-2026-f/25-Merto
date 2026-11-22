import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { it } from 'node:test';
import { createApp } from '../src/app.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';
import { hostedEvaluationContext } from '../src/evaluation/hosted.ts';
import { DEALS, EVENTS, STAFF } from '../src/seed-ids.ts';

it('switches hosted MPNet/rules on one database without mixing flags, reviews or metrics', async () => {
  const db = await sandboxDatabase();
  let loads = 0;
  const provider = hostedEvaluationContext(db, async () => {
    if (++loads === 1) throw Error('Transient cold-start failure');
    return {
      status: async () => ({ id: 'mpnet', name: 'MPNet v3', mode: 'model', version: 'test', ready: true }),
      detect: () => [{ evidenceEventId: EVENTS.mayaAllSet, flagType: 'tone', severity: 'low', explanation: 'Model finding' }],
    };
  });
  const server = createApp(db, { evaluationContext: provider }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(id: string, path: string, method = 'GET', body?: object, staff: string | null = STAFF.karen) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Merto-Demo-Evaluator': id };
    if (staff) headers['X-Staff-Id'] = staff;
    const response = await fetch(origin + path, { method, headers, body: body && JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }
  const deal = `/api/deals/${DEALS.maya}/evaluation`;
  try {
    assert.equal((await call('mpnet', '/api/ai-evaluation/engine', 'GET', undefined, null)).status, 401);
    assert.equal(loads, 0, 'Authentication precedes model initialization');
    assert.equal((await call('bge', '/api/ai-evaluation/engine')).status, 400);
    const rules = (await call('deterministic', '/api/ai-evaluation/engine')).body;
    assert.equal(rules.scope, 'hosted');
    assert.deepEqual(rules.choices.map((c: { id: string }) => c.id), ['deterministic', 'mpnet']);
    assert.equal(loads, 0, 'Rules never load the model');

    assert.equal((await call('mpnet', '/api/ai-evaluation/engine')).body.ready, false);
    assert.equal((await call('deterministic', deal, 'POST')).status, 200, 'Rules work during a model outage');
    assert.equal((await call('mpnet', '/api/ai-evaluation/engine')).body.ready, true, 'Failed initialization is retryable');
    assert.equal((await call('mpnet', deal)).body.status, 'not_evaluated');
    assert.equal((await call('mpnet', deal, 'POST', undefined, STAFF.dana)).status, 403);
    assert.equal((await call('mpnet', deal, 'POST')).body.newFlags, 1);
    const flag = (await call('mpnet', deal)).body.flags[0];
    assert.equal(flag.flagType, 'tone');
    assert.equal((await call('deterministic', deal)).body.flags[0].flagType, 'appointment_certainty');
    assert.equal((await call('deterministic', `/api/ai-flags/${flag.id}/review`, 'POST', { decision: 'resolved' })).status, 404);
    assert.equal((await call('mpnet', `/api/ai-flags/${flag.id}/review`, 'POST',
      { decision: 'confirmed_issue', note: 'Hosted model review' })).status, 200);
    assert.equal((await call('mpnet', deal, 'POST')).body.newFlags, 0, 'Reruns deduplicate inside the selected store');
    assert.equal((await call('mpnet', deal)).body.flags[0].reviewNote, 'Hosted model review');
    const modelMetrics = (await call('mpnet', '/api/ai-evaluation/metrics')).body;
    const rulesMetrics = (await call('deterministic', '/api/ai-evaluation/metrics')).body;
    assert.equal(modelMetrics.flags.confirmedIssue, 1);
    assert.equal(modelMetrics.flags.pending, 0);
    assert.equal(rulesMetrics.flags.confirmedIssue, 0);
    assert.equal(rulesMetrics.flags.pending, 1);
    assert.equal(loads, 2);
    const rows = await db.query<{ body: string }>(`select body from public.timeline_events
      where deal_id = $1 and event_type = 'ai_review'`, [DEALS.maya]);
    assert.ok(rows.some(row => row.body.includes('MPNet')));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});

it('records the model version on each run, its flags, and the GM flags it missed', async () => {
  const db = await sandboxDatabase();
  let version: string | undefined = 'v3-test';
  const provider = hostedEvaluationContext(db, async () => ({
    status: async () => ({ id: 'mpnet', name: 'MPNet v3', mode: 'model', version, ready: true }),
    detect: conversation => conversation.events.some(event => event.id === EVENTS.mayaAllSet)
      ? [{ evidenceEventId: EVENTS.mayaAllSet, flagType: 'tone', severity: 'low', explanation: 'Model finding' }] : [],
  }));
  const server = createApp(db, { evaluationContext: provider }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(id: string, path: string, method = 'GET', body?: object) {
    const response = await fetch(origin + path, { method, body: body && JSON.stringify(body), headers: {
      'Content-Type': 'application/json', 'X-Merto-Demo-Evaluator': id, 'X-Staff-Id': STAFF.karen } });
    return { status: response.status, body: await response.json() as any };
  }
  const maya = `/api/deals/${DEALS.maya}/evaluation`;
  const jordan = `/api/deals/${DEALS.jordan}/evaluation`;
  try {
    assert.equal((await call('mpnet', maya, 'POST')).body.modelVersion, 'v3-test');
    assert.deepEqual((await call('mpnet', maya)).body.flags.map((f: { modelVersion: string }) => f.modelVersion), ['v3-test']);
    await call('deterministic', maya, 'POST');
    const rules = (await call('deterministic', maya)).body;
    assert.equal(rules.modelVersion, null, 'The deterministic rules have no model version');
    assert.ok(rules.flags.every((f: { modelVersion: string | null }) => f.modelVersion === null));

    // A GM flag on a reply the model passed records the model that missed it.
    assert.equal((await call('mpnet', jordan, 'POST')).body.result, 'passed');
    version = 'v4-test';
    assert.equal((await call('mpnet', jordan, 'POST')).body.modelVersion, 'v4-test', 'A rerun records the newer version');
    const manual = await call('mpnet', `/api/deals/${DEALS.jordan}/flags`, 'POST',
      { evidenceEventId: EVENTS.jordanAiReply, flagType: 'tone' });
    assert.deepEqual([manual.status, manual.body.source, manual.body.modelVersion], [201, 'manual', 'v4-test']);
    assert.deepEqual((await call('mpnet', maya)).body.flags.map((f: { modelVersion: string }) => f.modelVersion),
      ['v3-test'], 'A rerun keeps the version that first raised a flag');

    // A model run that cannot name its version saves nothing.
    version = undefined;
    const before = await db.query('select * from public.mpnet_evaluations order by deal_id');
    assert.equal((await call('mpnet', maya, 'POST')).status, 503);
    assert.equal((await call('mpnet', '/api/evaluations/run', 'POST')).status, 503);
    assert.deepEqual(await db.query('select * from public.mpnet_evaluations order by deal_id'), before);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});

it('asks a second GM about reviews that strongly disagree with the model', async () => {
  const db = await sandboxDatabase();
  const secondGm = '10000000-0000-0000-0000-0000000000a2';
  await db.query(`insert into public.staff_users (id, name, role, email) values ($1, 'Second GM', 'gm', 'second-gm@example.test')`, [secondGm]);
  const provider = hostedEvaluationContext(db, async () => ({
    status: async () => ({ id: 'mpnet', name: 'MPNet v3', mode: 'model', version: 'v3-test', ready: true }),
    detect: conversation => conversation.events.some(event => event.id === EVENTS.mayaAllSet)
      ? [{ evidenceEventId: EVENTS.mayaAllSet, flagType: 'tone', severity: 'low', explanation: 'Model finding' }] : [],
    score: async () => ({ claims_booking: 0.5, guarantees_availability: 0.5, quotes_price: 0.5, off_tone: 0.97 }),
  }));
  const server = createApp(db, { evaluationContext: provider }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(path: string, method = 'GET', body?: object, staff: string = STAFF.karen) {
    const response = await fetch(origin + path, { method, body: body && JSON.stringify(body), headers: {
      'Content-Type': 'application/json', 'X-Merto-Demo-Evaluator': 'mpnet', 'X-Staff-Id': staff } });
    return { status: response.status, body: await response.json() as any };
  }
  try {
    await call(`/api/deals/${DEALS.maya}/evaluation`, 'POST');
    const flag = (await call(`/api/deals/${DEALS.maya}/evaluation`)).body.flags[0];
    assert.deepEqual((await call('/api/ai-flags/second-review')).body, [], 'Nothing is disputed before a review');

    // The model is 97% sure of a tone problem; the GM dismisses it as misread wording.
    const reviewed = await call(`/api/ai-flags/${flag.id}/review`, 'POST', { decision: 'false_positive', reason: 'misread_wording' });
    assert.equal(reviewed.body.modelScore, 0.97);
    const queue = (await call('/api/ai-flags/second-review')).body;
    assert.deepEqual(queue.map((item: { id: string; canReview: boolean }) => [item.id, item.canReview]), [[flag.id, false]]);
    assert.equal((await call(`/api/ai-flags/${flag.id}/second-review`, 'POST', { decision: 'agree' })).status, 409,
      'The first reviewer cannot give the second opinion');
    assert.equal((await call(`/api/ai-flags/${flag.id}/second-review`, 'POST', { decision: 'maybe' }, secondGm)).status, 400);
    assert.equal((await call(`/api/ai-flags/${flag.id}/second-review`, 'POST', { decision: 'agree' }, STAFF.dana)).status, 403);
    const agreed = await call(`/api/ai-flags/${flag.id}/second-review`, 'POST', { decision: 'agree' }, secondGm);
    assert.deepEqual([agreed.status, agreed.body.secondReview, agreed.body.secondReviewedBy], [200, 'agree', secondGm]);
    assert.equal((await call(`/api/ai-flags/${flag.id}/second-review`, 'POST', { decision: 'disagree' }, secondGm)).status, 409);
    assert.deepEqual((await call('/api/ai-flags/second-review')).body, []);

    // Changing the first review clears the second opinion, which was about the old decision.
    const changed = await call(`/api/ai-flags/${flag.id}/review`, 'POST', { decision: 'confirmed_issue' });
    assert.deepEqual([changed.body.reviewStatus, changed.body.secondReview], ['confirmed_issue', null]);
    assert.deepEqual((await call('/api/ai-flags/second-review')).body, [], 'A confirmation agrees with the model');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
