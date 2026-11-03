import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { it } from 'node:test';
import { createLocalDemoApp, DEMO_EVALUATOR_HEADER } from '../src/evaluation/local-demo.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';
import { DEALS, EVENTS, STAFF } from '../src/seed-ids.ts';
import { DEFAULT_RULES, type FlagType } from '../src/evaluation/rules.ts';

it('offers only MPNet/rules and retains separate results and reviews across switches', async () => {
  const loads: string[] = [];
  let databases = 0;
  const demo = await createLocalDemoApp({
    openDatabase: async () => { databases++; return sandboxDatabase(); },
    modelEngine: async id => {
      loads.push(id);
      return {
        status: async () => ({ mode: 'model', name: id, ready: true }),
        detect: () => {
          const type: FlagType = 'appointment_certainty';
          return [{ evidenceEventId: EVENTS.mayaAllSet, flagType: type,
            severity: DEFAULT_RULES[type].severity, explanation: DEFAULT_RULES[type].explanation }];
        },
      };
    },
  });
  const server = demo.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(id: string | null, path: string, method = 'GET', body?: object, staff: string | null = STAFF.karen) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (staff) headers['X-Staff-Id'] = staff;
    if (id) headers[DEMO_EVALUATOR_HEADER] = id;
    const res = await fetch(url + path, { method, headers, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() as any };
  }
  const path = `/api/deals/${DEALS.maya}/evaluation`;
  try {
    assert.equal((await call(null, '/api/ai-evaluation/engine')).body.id, 'mpnet');
    assert.equal((await call(null, '/api/ai-evaluation/engine', 'GET', undefined, null)).status, 401);
    assert.equal((await call('unknown', '/api/ai-evaluation/engine')).status, 400);
    assert.equal((await call('mpnet', path, 'POST', undefined, STAFF.dana)).status, 403);
    assert.equal((await call('mpnet', path, 'POST')).body.newFlags, 1);
    const flag = (await call('mpnet', path)).body.flags[0];
    assert.equal((await call('mpnet', `/api/ai-flags/${flag.id}/review`, 'POST',
      { decision: 'confirmed_issue', note: 'MPNet review only' })).status, 200);

    const choices = await Promise.all([call('mpnet', '/api/ai-evaluation/engine'), call('mpnet', '/api/ai-evaluation/engine')]);
    assert.ok(choices.every(r => r.body.id === 'mpnet' && r.body.choices.length === 2));
    assert.deepEqual(choices[0].body.choices.map((c: { id: string }) => c.id), ['mpnet', 'deterministic']);
    assert.equal(loads.filter(id => id === 'mpnet').length, 1, 'Concurrent selections share one context');
    assert.equal((await call('mpnet', path)).body.status, 'confirmed_issue');

    assert.equal((await call('bge', '/api/ai-evaluation/engine')).status, 400);
    assert.equal((await call('minilm', '/api/ai-evaluation/engine')).status, 400);
    assert.equal((await call('deterministic', `/api/ai-flags/${flag.id}/review`, 'POST', { decision: 'resolved' })).status, 404);

    assert.equal((await call('deterministic', path)).body.status, 'not_evaluated');
    assert.equal((await call('deterministic', path, 'POST')).body.newFlags, 1);
    assert.equal((await call('deterministic', path)).body.flags[0].flagType, 'appointment_certainty');
    assert.equal((await call('mpnet', path, 'POST')).body.newFlags, 0);
    assert.equal((await call('mpnet', path)).body.flags[0].reviewNote, 'MPNet review only');
    assert.equal(databases, 2, 'One independent sandbox for each evaluator');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await demo.close();
  }
});
