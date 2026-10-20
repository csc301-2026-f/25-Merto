import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DEALS, STAFF } from '../src/seed-ids.ts';
import { recordFollowUp } from '../src/follow-up/send-service.ts';
import { useApi } from './harness.ts';

describe('record simulated follow-up (US7)', () => {
  const api = useApi();
  const send = (as: string | null, dealId: string, body: object = {}) =>
    api.call(as, 'POST', `/api/deals/${dealId}/follow-ups`, body);
  const input = () => ({ requestId: randomUUID(), channel: 'sms', message: 'Thanks for visiting. Any questions about the Accord?' });
  const history = (dealId: string) => api.db.query('select * from public.timeline_events where deal_id = $1 order by id', [dealId]);

  it('records an attributed, timed follow-up in the buyer record and clears the visit reminder', async () => {
    const body = input();
    const result = await send(STAFF.dana, DEALS.maya, { ...body, actorId: STAFF.karen });
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'simulated_sent');
    assert.equal(result.body.eventId, body.requestId);
    assert.equal(result.body.followUp.status, 'not_due');
    assert.ok(Number.isFinite(Date.parse(result.body.recordedAt)));
    const record = (await api.call(STAFF.dana, 'GET', `/api/deals/${DEALS.maya}`)).body;
    const event = record.timeline.find((e: { id: string }) => e.id === body.requestId);
    assert.deepEqual([event.actorType, event.actorId, event.channel, event.direction], ['rep', STAFF.dana, 'sms', 'outbound']);
    assert.equal(event.body, '[Simulated follow-up] ' + body.message);
    const due = (await api.call(STAFF.dana, 'GET', '/api/follow-ups/due')).body;
    assert.ok(!due.some((item: { dealId: string }) => item.dealId === DEALS.maya));
  });

  it('does not mark an unresolved promise complete just because a message was recorded', async () => {
    const before = await api.db.query('select * from public.open_items where deal_id = $1 order by id', [DEALS.hannah]);
    const result = await send(STAFF.dana, DEALS.hannah, { ...input(), channel: 'email' });
    assert.equal(result.status, 200);
    assert.equal(result.body.followUp.status, 'due');
    assert.ok(result.body.followUp.reasons.some((r: { code: string }) => r.code === 'overdue_commitment'));
    assert.deepEqual(await api.db.query('select * from public.open_items where deal_id = $1 order by id', [DEALS.hannah]), before);
  });

  it('deduplicates concurrent retries and rejects reusing the request ID for different contents', async () => {
    const body = input();
    const results = await Promise.all([send(STAFF.dana, DEALS.maya, body), send(STAFF.dana, DEALS.maya, body)]);
    assert.ok(results.every(r => r.status === 200));
    assert.equal(results[0].body.recordedAt, results[1].body.recordedAt);
    assert.deepEqual(results.map(r => r.body.alreadyRecorded).sort(), [false, true]);
    assert.equal((await api.db.query('select id from public.timeline_events where id = $1', [body.requestId])).length, 1);
    assert.equal((await send(STAFF.dana, DEALS.maya, { ...body, message: 'Different message' })).status, 409);
    assert.equal((await send(STAFF.dana, DEALS.maya, input())).status, 409, 'The reminder is no longer due');
  });

  it('enforces current ownership and the caller on the server', async () => {
    const before = await history(DEALS.maya);
    assert.equal((await send(null, DEALS.maya, input())).status, 401);
    assert.equal((await send(STAFF.arjun, DEALS.maya, input())).status, 403);
    assert.equal((await send(STAFF.dana, DEALS.nina, input())).status, 403);
    assert.deepEqual(await history(DEALS.maya), before);
    await api.call(STAFF.karen, 'POST', `/api/deals/${DEALS.maya}/transfer`, { toUserId: STAFF.arjun, reason: 'Dana is away' });
    assert.equal((await send(STAFF.dana, DEALS.maya, input())).status, 403);
    assert.equal((await send(STAFF.arjun, DEALS.maya, input())).status, 200);
  });

  it('lets the GM record a follow-up with the GM identity on an unassigned eligible deal', async () => {
    const body = { ...input(), channel: 'email' };
    assert.equal((await send(STAFF.karen, DEALS.nina, body)).status, 200);
    const [event] = await api.db.query<{ actor_type: string; actor_id: string }>('select actor_type, actor_id from public.timeline_events where id = $1', [body.requestId]);
    assert.deepEqual(event, { actor_type: 'gm', actor_id: STAFF.karen });
  });

  it('blocks closed deals, opted-out buyers, and buyers not currently due', async () => {
    for (const dealId of [DEALS.rob, DEALS.chris, DEALS.jordan, DEALS.marcus]) {
      const before = await history(dealId);
      assert.equal((await send(STAFF.karen, dealId, input())).status, 409);
      assert.deepEqual(await history(dealId), before);
    }
    // Isolate the current boolean opt-out from the closed-stage check.
    await api.db.query('update public.buyers set opted_out = true where id = (select buyer_id from public.deals where id = $1)', [DEALS.maya]);
    const result = await send(STAFF.dana, DEALS.maya, input());
    assert.equal(result.status, 409);
    assert.match(result.body.error, /opted out/);
  });

  it('blocks an opt-out recorded on another deal even if the buyer boolean is false', async () => {
    const second = await api.call(STAFF.karen, 'POST', '/api/deals',
      { name: 'Hannah Clarke', email: 'hannah@example.com', vehicleInterest: 'Civic', source: 'email' });
    await api.db.query(`insert into public.timeline_events (deal_id, event_type, actor_type, channel, direction, body)
      values ($1, 'opt_out', 'buyer', 'email', 'inbound', 'Do not contact me')`, [second.body.dealId]);
    const before = await history(DEALS.hannah);
    assert.equal((await send(STAFF.dana, DEALS.hannah, { ...input(), channel: 'email' })).status, 409);
    assert.deepEqual(await history(DEALS.hannah), before);
  });

  it('validates channel, contact details, message length, and IDs without writing events', async () => {
    const before = await history(DEALS.maya);
    for (const body of [{}, { ...input(), requestId: 'bad' }, { ...input(), channel: 'web' },
      { ...input(), message: '' }, { ...input(), message: '   ' }, { ...input(), message: 'x'.repeat(2001) },
      { ...input(), message: 5 }, { ...input(), channel: 'email' }]) {
      assert.equal((await send(STAFF.dana, DEALS.maya, body)).status, 400);
    }
    assert.equal((await send(STAFF.dana, 'not-a-uuid', input())).status, 400);
    assert.equal((await send(STAFF.dana, 'ffffffff-ffff-ffff-ffff-ffffffffffff', input())).status, 404);
    assert.deepEqual(await history(DEALS.maya), before);
    assert.equal((await send(STAFF.dana, DEALS.maya, { ...input(), channel: 'call', message: '  Called to discuss the visit.  ' })).status, 200);
  });

  it('rolls back the recorded event if refreshing its follow-up status fails', async () => {
    const before = await history(DEALS.maya);
    const failure = Error('Injected read failure after recording');
    const original = api.db.transaction.bind(api.db);
    api.db.transaction = work => original(async tx => {
      let inserted = false;
      return work({
        async query<Row>(sql: string, params?: unknown[]): Promise<Row[]> {
          if (inserted) throw failure;
          const rows = await tx.query<Row>(sql, params);
          if (sql.includes('insert into public.timeline_events')) inserted = true;
          return rows;
        },
      });
    });
    await assert.rejects(recordFollowUp(api.db, { id: STAFF.dana, name: 'Dana', role: 'rep' }, DEALS.maya, input()), e => e === failure);
    assert.deepEqual(await history(DEALS.maya), before);
  });
});
