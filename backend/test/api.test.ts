import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.ts';
import type { Database } from '../src/db.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';
import { DEALS, EVENTS, STAFF } from '../src/seed-ids.ts';

// Each test gets a fresh in-memory database built from supabase/migrations and
// supabase/seed, and talks to the API over real HTTP.
describe('evaluation API', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await sandboxDatabase();
    server = createApp(db).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    server.close();
    await db.close();
  });

  async function call(as: string | null, method: string, path: string, body?: object) {
    const headers: Record<string, string> = {};
    if (as) headers['x-staff-id'] = as;
    if (body) headers['content-type'] = 'application/json';
    const response = await fetch(baseUrl + path, { method, headers, body: body && JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }

  const runEvaluation = () => call(STAFF.karen, 'POST', '/api/evaluations/run');
  const review = (as: string, flagId: string, decision: string, note?: string) =>
    call(as, 'POST', `/api/ai-flags/${flagId}/review`, { decision, note });
  async function flagId(eventId: string, flagType: string): Promise<string> {
    const [row] = await db.query<{ id: string }>(
      'select id from public.ai_flags where evidence_event_id = $1 and flag_type = $2', [eventId, flagType]);
    return row.id;
  }

  it('requires a known staff member and well-formed IDs', async () => {
    assert.equal((await call(null, 'GET', '/api/ai-flags/queue')).status, 401);
    assert.equal((await call('ffffffff-ffff-ffff-ffff-ffffffffffff', 'GET', '/api/ai-flags/queue')).status, 401);
    assert.equal((await call(STAFF.karen, 'GET', '/api/deals/not-a-uuid/evaluation')).status, 400);
    assert.equal((await call(STAFF.karen, 'POST', '/api/deals/ffffffff-ffff-ffff-ffff-ffffffffffff/evaluation')).status, 404);
    assert.equal((await call(STAFF.karen, 'GET', '/api/nope')).status, 404);
  });

  it('flags the seeded AI mistakes and passes clean conversations', async () => {
    const { status, body } = await runEvaluation();
    assert.equal(status, 200);
    // Hannah and Nina have no AI activity, so the nightly job skips them. Ben's payment
    // reply raises 3 flags: it quotes a number, ignores his request for a person, and
    // hands the price question to nobody; his first text raises a tone flag.
    assert.deepEqual(body.map((row: { buyer: string; result: string; newFlags: number }) =>
      [row.buyer, row.result, row.newFlags]).sort(), [
      ['Ben Okafor', 'flagged', 5], ['Chris Patel', 'flagged', 1], ['Jordan Lee', 'passed', 0],
      ['Marcus Johnson', 'passed', 0], ['Maya Desai', 'flagged', 1], ['Rob Lindqvist', 'passed', 0],
    ]);
    const queue = (await call(STAFF.karen, 'GET', '/api/ai-flags/queue')).body;
    assert.deepEqual(queue.map((flag: { severity: string }) => flag.severity), ['high', 'high', 'high', 'medium', 'medium', 'low', 'low']);
    const maya = queue.find((flag: { buyer: string }) => flag.buyer === 'Maya Desai');
    assert.equal(maya.evidenceEventId, EVENTS.mayaAllSet);
    assert.match(maya.evidenceBody, /You're all set/);

    const logged = await db.query<{ deal_id: string }>(
      "select deal_id from public.timeline_events where event_type = 'ai_evaluation' and actor_type = 'system' order by deal_id");
    assert.deepEqual(logged.map((row) => row.deal_id), [DEALS.maya, DEALS.chris, DEALS.ben]);
  });

  it('can be rerun without duplicating flags or timeline entries', async () => {
    const counts = () => db.query(`select (select count(*)::int from public.ai_flags) as flags,
      (select count(*)::int from public.timeline_events) as events`);
    await runEvaluation();
    const before = await counts();
    const rerun = await runEvaluation();
    assert.ok(rerun.body.every((row: { newFlags: number }) => row.newFlags === 0));
    assert.deepEqual(await counts(), before);
  });

  it('only lets the GM run evaluations and see store-wide metrics', async () => {
    assert.equal((await call(STAFF.dana, 'POST', '/api/evaluations/run')).status, 403);
    assert.equal((await call(STAFF.dana, 'POST', `/api/deals/${DEALS.maya}/evaluation`)).status, 403);
    assert.equal((await call(STAFF.dana, 'GET', '/api/ai-evaluation/metrics')).status, 403);
  });

  it("shows a rep only their own deals' flags and records", async () => {
    await runEvaluation();
    const danaQueue = (await call(STAFF.dana, 'GET', '/api/ai-flags/queue')).body;
    assert.deepEqual(danaQueue.map((flag: { buyer: string }) => flag.buyer), ['Maya Desai']);
    assert.equal((await call(STAFF.arjun, 'GET', `/api/deals/${DEALS.maya}/evaluation`)).status, 403);
    assert.equal((await call(STAFF.arjun, 'GET', `/api/deals/${DEALS.maya}/evaluation/preview`)).status, 403);
    const record = await call(STAFF.dana, 'GET', `/api/deals/${DEALS.maya}/evaluation`);
    assert.equal(record.status, 200);
    assert.equal(record.body.status, 'flagged');
  });

  it('previews issues without writing anything', async () => {
    const preview = await call(STAFF.dana, 'GET', `/api/deals/${DEALS.maya}/evaluation/preview`);
    assert.deepEqual(preview.body.map((issue: { flagType: string; evidenceEventId: string }) =>
      [issue.flagType, issue.evidenceEventId]), [['appointment_certainty', EVENTS.mayaAllSet]]);
    assert.match(preview.body[0].evidenceBody, /You're all set/);
    assert.deepEqual((await call(STAFF.karen, 'GET', `/api/deals/${DEALS.jordan}/evaluation/preview`)).body, []);
    assert.deepEqual((await call(STAFF.arjun, 'GET', `/api/deals/${DEALS.marcus}/evaluation/preview`)).body, [],
      'Deal C: the AI handed the price question to Arjun with a to-do');
    assert.equal((await call(STAFF.karen, 'GET', `/api/deals/${DEALS.maya}/evaluation`)).body.status, 'not_evaluated');
  });

  it('lets only the GM review, records the decision on the timeline, and clears the queue', async () => {
    await runEvaluation();
    const id = await flagId(EVENTS.mayaAllSet, 'appointment_certainty');
    assert.equal((await review(STAFF.dana, id, 'false_positive')).status, 403);

    const reviewed = await review(STAFF.karen, id, 'confirmed_issue', 'Maya arrived unexpected.');
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.reviewStatus, 'confirmed_issue');
    assert.equal(reviewed.body.reviewedBy, STAFF.karen);

    const queue = (await call(STAFF.karen, 'GET', '/api/ai-flags/queue')).body;
    assert.ok(!queue.some((flag: { id: string }) => flag.id === id));
    const [entry] = await db.query<{ actor_type: string; actor_id: string; body: string }>(
      "select actor_type, actor_id, body from public.timeline_events where deal_id = $1 and event_type = 'ai_review'", [DEALS.maya]);
    assert.deepEqual([entry.actor_type, entry.actor_id], ['gm', STAFF.karen]);
    assert.match(entry.body, /\(appointment certainty\): confirmed issue\. Note: Maya arrived unexpected\./);
    assert.equal((await call(STAFF.dana, 'GET', `/api/deals/${DEALS.maya}/evaluation`)).body.status, 'confirmed_issue');
  });

  it('rejects unknown decisions and flags', async () => {
    await runEvaluation();
    const id = await flagId(EVENTS.mayaAllSet, 'appointment_certainty');
    assert.equal((await review(STAFF.karen, id, 'pending')).status, 400);
    assert.equal((await review(STAFF.karen, id, 'escalated')).status, 400);
    assert.equal((await call(STAFF.karen, 'POST', `/api/ai-flags/${id}/review`, { decision: 'resolved', note: 5 })).status, 400);
    assert.equal((await review(STAFF.karen, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'resolved')).status, 404);
  });

  it('only allows review decisions that move a flag forward', async () => {
    await runEvaluation();
    const id = await flagId(EVENTS.mayaAllSet, 'appointment_certainty');
    assert.equal((await review(STAFF.karen, id, 'confirmed_issue')).status, 200);
    assert.equal((await review(STAFF.karen, id, 'resolved')).status, 200);
    // A resolved flag is final: no flipping it, and no logging the same decision twice.
    assert.equal((await review(STAFF.karen, id, 'false_positive')).status, 409);
    assert.equal((await review(STAFF.karen, id, 'resolved')).status, 409);
    const [{ reviews }] = await db.query<{ reviews: number }>(
      "select count(*)::int as reviews from public.timeline_events where event_type = 'ai_review'");
    assert.equal(reviews, 2);

    // A GM can correct an earlier call, but not repeat it.
    const tone = await flagId(EVENTS.benDoubleExclamation, 'tone');
    assert.equal((await review(STAFF.karen, tone, 'false_positive')).status, 200);
    assert.equal((await review(STAFF.karen, tone, 'false_positive')).status, 409);
    assert.equal((await review(STAFF.karen, tone, 'confirmed_issue')).status, 200);
  });

  it('keeps GM decisions when the evaluation runs again', async () => {
    await runEvaluation();
    const id = await flagId(EVENTS.benDoubleExclamation, 'tone');
    await review(STAFF.karen, id, 'false_positive', 'Friendly, not pushy.');
    await runEvaluation();
    const flags = (await call(STAFF.karen, 'GET', `/api/deals/${DEALS.ben}/evaluation`)).body.flags;
    const tone = flags.find((flag: { id: string }) => flag.id === id);
    assert.deepEqual([tone.reviewStatus, tone.reviewNote], ['false_positive', 'Friendly, not pushy.']);
  });

  it('reports metrics with null ("not measured") instead of zero rates', async () => {
    const metrics = async () => (await call(STAFF.karen, 'GET', '/api/ai-evaluation/metrics')).body;
    assert.deepEqual(await metrics(), {
      evaluatedConversations: 0, flaggedConversations: 0, flagRate: null,
      flags: { pending: 0, confirmedIssue: 0, falsePositive: 0, resolved: 0 }, reviewedPrecision: null,
    });
    await runEvaluation();
    await review(STAFF.karen, await flagId(EVENTS.mayaAllSet, 'appointment_certainty'), 'confirmed_issue');
    await review(STAFF.karen, await flagId(EVENTS.benDoubleExclamation, 'tone'), 'false_positive');
    assert.deepEqual(await metrics(), {
      evaluatedConversations: 6, flaggedConversations: 3, flagRate: 0.5,
      flags: { pending: 5, confirmedIssue: 1, falsePositive: 1, resolved: 0 }, reviewedPrecision: 0.5,
    });
  });

  it('flags a message sent after the buyer opted out, on any of their deals', async () => {
    const [other] = await db.query<{ id: string }>(`insert into public.deals (buyer_id, owner_id, vehicle_interest, source)
      select buyer_id, owner_id, 'Used Kia Sportage', 'email' from public.deals where id = $1 returning id`, [DEALS.rob]);
    const [late] = await db.query<{ id: string }>(`insert into public.timeline_events (deal_id, actor_type, channel, direction, body)
      values ($1, 'ai', 'sms', 'outbound', 'Still interested?') returning id`, [other.id]);
    const evaluated = await call(STAFF.karen, 'POST', `/api/deals/${other.id}/evaluation`);
    assert.deepEqual([evaluated.body.result, evaluated.body.newFlags], ['flagged', 1]);
    const { flags } = (await call(STAFF.arjun, 'GET', `/api/deals/${other.id}/evaluation`)).body;
    assert.deepEqual(flags.map((flag: { flagType: string; evidenceEventId: string }) =>
      [flag.flagType, flag.evidenceEventId]), [['ignored_opt_out', late.id]]);
  });

  it('rejects stored flags whose evidence belongs to another deal', async () => {
    await call(STAFF.karen, 'POST', `/api/deals/${DEALS.maya}/evaluation`);
    await assert.rejects(db.query(`insert into public.ai_flags (deal_id, evidence_event_id, flag_type, severity, explanation)
      values ($1, $2, 'tone', 'low', 'Wrong deal')`, [DEALS.maya, EVENTS.chrisDefinitelyHere]),
    (error: { code?: string }) => error.code === '23503');
  });
});
