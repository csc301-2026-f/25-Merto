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
