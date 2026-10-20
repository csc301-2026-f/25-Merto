import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEALS, STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

interface DueItem {
  dealId: string;
  owner: { id: string; name: string } | null;
  dueAt: string;
  reasons: { code: string; kind: string; text: string; since: string; dueAt: string }[];
}

// Several seed files load, so these tests name known deals rather than count rows.
describe('follow-up API (US6)', () => {
  const api = useApi();
  const { call } = api;
  const due = async (as: string) => (await call(as, 'GET', '/api/follow-ups/due')).body as DueItem[];
  const find = (list: DueItem[], dealId: string) => list.find((item) => item.dealId === dealId);
  const status = async (as: string, dealId: string) => call(as, 'GET', `/api/deals/${dealId}/follow-up`);

  it('lists every due buyer for the GM, unassigned ones included, most overdue first, each with reasons', async () => {
    const list = await due(STAFF.karen);
    const hannah = find(list, DEALS.hannah);
    assert.ok(hannah, 'Hannah\'s promised quote is overdue');
    assert.deepEqual(hannah.reasons.map((reason) => reason.code), ['overdue_commitment']);
    assert.match(hannah.reasons[0].text, /^Overdue promise \(due 1 hour ago\): Send the CR-V lease quote/);
    assert.deepEqual(hannah.owner, { id: STAFF.dana, name: 'Dana Kowalski' });

    const nina = find(list, DEALS.nina);
    assert.equal(nina?.owner, null, 'Unassigned deals are on the GM\'s list');
    assert.ok(find(list, DEALS.ben)?.reasons.some((reason) => reason.text.includes('only the AI answered')));

    assert.ok(list.every((item) => item.reasons.length > 0));
    const times = list.map((item) => Date.parse(item.dueAt));
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
    for (const quiet of [DEALS.jordan, DEALS.rob, DEALS.marcus, DEALS.chris]) {
      assert.equal(find(list, quiet), undefined, quiet);
    }
  });

  it('shows a rep only their own due buyers', async () => {
    const dana = await due(STAFF.dana);
    assert.ok(dana.length > 0);
    assert.ok(dana.every((item) => item.owner?.id === STAFF.dana));
    assert.ok(find(dana, DEALS.hannah) && find(dana, DEALS.maya));
    assert.equal(find(dana, DEALS.nina), undefined);
    assert.equal(find(await due(STAFF.arjun), DEALS.hannah), undefined);
  });

  it('explains one buyer\'s status: due, suppressed, or not due', async () => {
    const hannah = await status(STAFF.dana, DEALS.hannah);
    assert.equal(hannah.status, 200);
    assert.equal(hannah.body.status, 'due');
    assert.equal(hannah.body.buyer.name, 'Hannah Clarke');

    const jordan = (await status(STAFF.dana, DEALS.jordan)).body;
    assert.deepEqual([jordan.status, jordan.reasons], ['suppressed', []]);
    assert.deepEqual(jordan.suppressions.map((s: { code: string }) => s.code), ['appointment_upcoming']);

    const rob = (await status(STAFF.karen, DEALS.rob)).body;
    assert.deepEqual(rob.suppressions.map((s: { code: string }) => s.code), ['opted_out', 'deal_closed']);

    const marcus = (await status(STAFF.arjun, DEALS.marcus)).body;
    assert.deepEqual([marcus.status, marcus.dueAt, marcus.reasons, marcus.suppressions], ['not_due', null, [], []]);
  });

  it('stops flagging a buyer once the follow-up is recorded', async () => {
    assert.ok(find(await due(STAFF.dana), DEALS.maya));
    // What US7 will write when a follow-up is sent: an outbound event on the deal.
    await api.db.query(`
      insert into public.timeline_events (deal_id, actor_type, actor_id, channel, direction, body)
      values ($1, 'rep', $2, 'sms', 'outbound', '[Simulated] Thanks for visiting. Any questions about the Accord?')`,
    [DEALS.maya, STAFF.dana]);
    assert.equal(find(await due(STAFF.dana), DEALS.maya), undefined);
    assert.equal((await status(STAFF.dana, DEALS.maya)).body.status, 'not_due');

    // Hannah's reason is an open promise: it clears when the item is resolved.
    await api.db.query(`update public.open_items set status = 'resolved', resolved_at = now()
      where deal_id = $1 and status = 'open'`, [DEALS.hannah]);
    assert.equal(find(await due(STAFF.dana), DEALS.hannah), undefined);
  });

  it('suppresses a buyer who opts out on any of their deals', async () => {
    assert.ok(find(await due(STAFF.dana), DEALS.hannah));
    // Hannah enquires about a second car, then opts out on that deal.
    const second = await call(STAFF.karen, 'POST', '/api/deals',
      { name: 'Hannah Clarke', email: 'hannah@example.com', vehicleInterest: 'Honda Civic', source: 'email' });
    assert.equal(second.body.buyer.existing, true);
    await api.db.query(`
      insert into public.timeline_events (deal_id, event_type, actor_type, channel, direction, body)
      values ($1, 'opt_out', 'buyer', 'email', 'inbound', 'Please stop contacting me.')`, [second.body.dealId]);
    assert.equal(find(await due(STAFF.dana), DEALS.hannah), undefined);
    assert.equal((await status(STAFF.dana, DEALS.hannah)).body.suppressions[0].code, 'opted_out');
  });

  it('moves a due buyer to the new owner\'s list on transfer', async () => {
    await call(STAFF.karen, 'POST', `/api/deals/${DEALS.hannah}/transfer`,
      { toUserId: STAFF.arjun, reason: 'Arjun is back on shift' });
    assert.equal(find(await due(STAFF.dana), DEALS.hannah), undefined);
    assert.ok(find(await due(STAFF.arjun), DEALS.hannah));
  });

  it('checks the caller and deal access on the server', async () => {
    assert.equal((await call(null, 'GET', '/api/follow-ups/due')).status, 401);
    assert.equal((await call(null, 'GET', `/api/deals/${DEALS.hannah}/follow-up`)).status, 401);
    assert.equal((await status(STAFF.arjun, DEALS.hannah)).status, 403, "Another rep's deal");
    assert.equal((await status(STAFF.dana, DEALS.nina)).status, 403, 'An unassigned deal');
    assert.equal((await status(STAFF.karen, 'ffffffff-ffff-ffff-ffff-ffffffffffff')).status, 404);
    assert.equal((await status(STAFF.karen, 'not-a-uuid')).status, 400);
    // The buyer record route still answers its own path.
    assert.equal((await call(STAFF.dana, 'GET', `/api/deals/${DEALS.hannah}`)).body.buyer.name, 'Hannah Clarke');
  });
});
