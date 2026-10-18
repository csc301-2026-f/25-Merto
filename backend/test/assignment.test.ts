import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assignmentBody, parseReason } from '../src/assignment/policy.ts';
import { DEALS, EVENTS, STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

describe('assignment policy', () => {
  it('requires a reason and normalises whitespace', () => {
    assert.equal(parseReason('  Arjun\n is   away '), 'Arjun is away');
    for (const bad of [undefined, null, 5, '', '   \n']) assert.throws(() => parseReason(bad), /required/);
    assert.throws(() => parseReason('x'.repeat(501)), /at most 500/);
    assert.equal(parseReason('x'.repeat(500)).length, 500);
  });

  it('formats the timeline body like the seeded history', () => {
    assert.equal(assignmentBody('Nina Shah', null, 'Dana Kowalski', 'Buyer asked for Dana'),
      'Assigned Nina Shah to Dana Kowalski: Buyer asked for Dana');
    assert.equal(assignmentBody('Hannah Clarke', 'Arjun Mehta', 'Dana Kowalski', 'Arjun is away'),
      'Transferred Hannah Clarke from Arjun Mehta to Dana Kowalski: Arjun is away');
  });
});

describe('assignment API (US8)', () => {
  const api = useApi();
  const { call } = api;

  const assign = (as: string, dealId: string, toUserId: string, reason?: string, extra: object = {}) =>
    call(as, 'POST', `/api/deals/${dealId}/assign`, { toUserId, reason, ...extra });
  const transfer = (as: string, dealId: string, toUserId: string, reason?: string, extra: object = {}) =>
    call(as, 'POST', `/api/deals/${dealId}/transfer`, { toUserId, reason, ...extra });
  const dealRow = async (dealId: string) =>
    (await api.db.query<{ owner_id: string | null; stage: string }>(
      'select owner_id, stage from public.deals where id = $1', [dealId]))[0];
  const records = (dealId: string) => api.db.query<Record<string, unknown>>(`
    select kind, from_owner_id, to_owner_id, assigned_by, reason, open_items_moved,
      timeline_event_id, created_at from public.deal_assignments where deal_id = $1
    order by created_at, id`, [dealId]);

  it('lists unassigned buyers for the GM only, oldest first', async () => {
    const list = await call(STAFF.karen, 'GET', '/api/deals/unassigned');
    assert.equal(list.status, 200);
    // Other seed files add unassigned buyers too, so compare with the database.
    const open = await api.db.query<{ id: string }>(`select id from public.deals
      where owner_id is null and stage not in ('delivered', 'lost') order by created_at, id`);
    assert.deepEqual(list.body.map((deal: { dealId: string }) => deal.dealId), open.map((row) => row.id));
    assert.ok([DEALS.nina, DEALS.ben].every((id) => list.body.some((deal: { dealId: string }) => deal.dealId === id)));
    assert.equal((await call(STAFF.dana, 'GET', '/api/deals/unassigned')).status, 403);
    assert.equal((await call(null, 'GET', '/api/deals/unassigned')).status, 401);
  });

  it('lists every rep with their open workload, for the GM only', async () => {
    const reps = await call(STAFF.karen, 'GET', '/api/staff/reps');
    assert.equal(reps.status, 200);
    const expected = await api.db.query<{ id: string; active: number }>(`
      select s.id, count(d.id) filter (where d.stage not in ('delivered', 'lost'))::int as active
      from public.staff_users s left join public.deals d on d.owner_id = s.id
      where s.role = 'rep' group by s.id order by s.name, s.id`);
    assert.deepEqual(reps.body.map((rep: { id: string; activeDeals: number }) => [rep.id, rep.activeDeals]),
      expected.map((row) => [row.id, row.active]));
    assert.ok(!reps.body.some((rep: { id: string }) => rep.id === STAFF.karen), 'A GM is not a target');
    assert.equal((await call(STAFF.dana, 'GET', '/api/staff/reps')).status, 403);

    await assign(STAFF.karen, DEALS.nina, STAFF.dana, 'Round robin');
    const after = (await call(STAFF.karen, 'GET', '/api/staff/reps')).body;
    const dana = (list: { id: string; activeDeals: number }[]) => list.find((rep) => rep.id === STAFF.dana)!.activeDeals;
    assert.equal(dana(after), dana(reps.body) + 1);
  });

  it('assigns an unassigned buyer: owner, stage, open item, timeline, and record', async () => {
    const { status, body } = await assign(STAFF.karen, DEALS.nina, STAFF.dana, 'Buyer asked for Dana');
    assert.equal(status, 200);
    assert.equal(body.kind, 'assignment');
    assert.deepEqual(body.by, { id: STAFF.karen, name: 'Karen Holt' });
    assert.equal(body.from, null);
    assert.deepEqual(body.to, { id: STAFF.dana, name: 'Dana Kowalski' });
    assert.equal(body.reason, 'Buyer asked for Dana');
    assert.equal(body.openItemsMoved, 1);
    assert.deepEqual(await dealRow(DEALS.nina), { owner_id: STAFF.dana, stage: 'assigned' });

    const [item] = await api.db.query<{ owner_id: string }>(
      "select owner_id from public.open_items where deal_id = $1 and status = 'open'", [DEALS.nina]);
    assert.equal(item.owner_id, STAFF.dana);

    // Who, when, from whom, to whom, and why, as columns rather than text.
    const [event] = await api.db.query<{ id: string; created_at: Date; body: string }>(
      "select id, created_at, body from public.timeline_events where deal_id = $1 and event_type = 'assignment'",
      [DEALS.nina]);
    assert.equal(event.body, 'Assigned Nina Shah to Dana Kowalski: Buyer asked for Dana');
    assert.deepEqual(await records(DEALS.nina), [{
      kind: 'assignment', from_owner_id: null, to_owner_id: STAFF.dana, assigned_by: STAFF.karen,
      reason: 'Buyer asked for Dana', open_items_moved: 1, timeline_event_id: event.id, created_at: event.created_at,
    }]);
    assert.equal(body.eventId, event.id);

    const history = (await call(STAFF.karen, 'GET', `/api/deals/${DEALS.nina}/assignments`)).body;
    assert.equal(history.currentOwner.name, 'Dana Kowalski');
    assert.deepEqual(history.history, [{
      eventId: event.id, kind: 'assignment', at: event.created_at.toISOString(),
      by: { id: STAFF.karen, name: 'Karen Holt' }, from: null, to: { id: STAFF.dana, name: 'Dana Kowalski' },
      reason: 'Buyer asked for Dana', openItemsMoved: 1, body: event.body, structured: true,
    }]);

    // Now owned, so the buyer leaves the unassigned list and Dana can read the history.
    const unassigned = (await call(STAFF.karen, 'GET', '/api/deals/unassigned')).body
      .map((deal: { dealId: string }) => deal.dealId);
    assert.ok(!unassigned.includes(DEALS.nina));
    assert.ok(unassigned.includes(DEALS.ben));
    assert.equal((await call(STAFF.dana, 'GET', `/api/deals/${DEALS.nina}/assignments`)).status, 200);
  });

  it('keeps the stage when assigning a deal that is already past new', async () => {
    assert.equal((await assign(STAFF.karen, DEALS.ben, STAFF.arjun, 'Round robin')).status, 200);
    assert.deepEqual(await dealRow(DEALS.ben), { owner_id: STAFF.arjun, stage: 'engaged' });
  });

  it('transfers a deal and keeps all history attached', async () => {
    const count = async (table: string) =>
      // Table names come only from the fixed list below.
      (await api.db.query(`select id from public.${table} where deal_id = $1`, [DEALS.hannah])).length;
    const tables = ['timeline_events', 'appointments', 'open_items'];
    const before = await Promise.all(tables.map(count));
    const { status, body } = await transfer(STAFF.karen, DEALS.hannah, STAFF.arjun, 'Arjun is back on shift');
    assert.equal(status, 200);
    assert.deepEqual(body.from, { id: STAFF.dana, name: 'Dana Kowalski' });
    assert.deepEqual(body.to, { id: STAFF.arjun, name: 'Arjun Mehta' });
    assert.deepEqual(await dealRow(DEALS.hannah), { owner_id: STAFF.arjun, stage: 'working' });
    // Only the new transfer event is added; nothing is lost or duplicated.
    assert.deepEqual(await Promise.all(tables.map(count)), [before[0] + 1, before[1], before[2]]);

    // The seeded transfer (Arjun to Dana) and this one, both structured.
    const history = (await call(STAFF.karen, 'GET', `/api/deals/${DEALS.hannah}/assignments`)).body.history;
    assert.deepEqual(history.map((entry: { kind: string; from: { name: string }; to: { name: string }; reason: string }) =>
      [entry.kind, entry.from.name, entry.to.name, entry.reason]), [
      ['transfer', 'Arjun Mehta', 'Dana Kowalski', 'Arjun is away. Quote still pending.'],
      ['transfer', 'Dana Kowalski', 'Arjun Mehta', 'Arjun is back on shift'],
    ]);
    assert.equal(history[0].eventId, EVENTS.hannahTransferred);
    assert.equal(history[1].body, 'Transferred Hannah Clarke from Dana Kowalski to Arjun Mehta: Arjun is back on shift');
  });

  it('returns older text-only entries without inventing from, to, or why', async () => {
    const history = (await call(STAFF.karen, 'GET', `/api/deals/${DEALS.jordan}/assignments`)).body.history;
    assert.deepEqual(history, [{
      eventId: EVENTS.jordanAssigned, kind: 'assignment', at: history[0].at,
      by: { id: STAFF.karen, name: 'Karen Holt' }, from: null, to: null, reason: null,
      openItemsMoved: null, body: 'Assigned Jordan to Dana.', structured: false,
    }]);
  });

  it('moves only open items to the new owner', async () => {
    await transfer(STAFF.karen, DEALS.jordan, STAFF.arjun, 'Dana is out');
    const items = await api.db.query<{ status: string; owner_id: string }>(
      'select status, owner_id from public.open_items where deal_id = $1 order by status', [DEALS.jordan]);
    assert.deepEqual(items, [
      { status: 'open', owner_id: STAFF.arjun },
      { status: 'resolved', owner_id: STAFF.dana },
    ]);
  });

  it('shows the former owner no access after a transfer', async () => {
    await transfer(STAFF.karen, DEALS.hannah, STAFF.arjun, 'Arjun is back on shift');
    assert.equal((await call(STAFF.dana, 'GET', `/api/deals/${DEALS.hannah}/assignments`)).status, 403);
    assert.equal((await call(STAFF.arjun, 'GET', `/api/deals/${DEALS.hannah}/assignments`)).status, 200);
  });

  it('is GM-only on the server', async () => {
    assert.equal((await assign(STAFF.dana, DEALS.nina, STAFF.dana, 'Taking it')).status, 403);
    assert.equal((await transfer(STAFF.dana, DEALS.hannah, STAFF.arjun, 'Giving it away')).status, 403);
    assert.deepEqual(await dealRow(DEALS.nina), { owner_id: null, stage: 'new' });
    assert.equal((await dealRow(DEALS.hannah)).owner_id, STAFF.dana);
    assert.deepEqual(await records(DEALS.nina), []);
  });

  it('rejects a missing reason and bad targets without changing anything', async () => {
    assert.equal((await assign(STAFF.karen, DEALS.nina, STAFF.dana)).status, 400);
    assert.equal((await assign(STAFF.karen, DEALS.nina, STAFF.dana, '   ')).status, 400);
    assert.equal((await call(STAFF.karen, 'POST', `/api/deals/${DEALS.nina}/assign`, { reason: 'x' })).status, 400);
    assert.equal((await assign(STAFF.karen, DEALS.nina, 'not-a-uuid', 'x')).status, 400);
    assert.equal((await assign(STAFF.karen, DEALS.nina, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'x')).status, 404);
    // A GM is not a rep, so a deal cannot be given to one.
    assert.equal((await assign(STAFF.karen, DEALS.nina, STAFF.karen, 'Mine')).status, 400);
    assert.equal((await assign(STAFF.karen, 'ffffffff-ffff-ffff-ffff-ffffffffffff', STAFF.dana, 'x')).status, 404);
    assert.equal((await assign(STAFF.karen, 'not-a-uuid', STAFF.dana, 'x')).status, 400);
    assert.deepEqual(await dealRow(DEALS.nina), { owner_id: null, stage: 'new' });
    const [{ count }] = await api.db.query<{ count: string }>(
      "select count(*) from public.timeline_events where event_type in ('assignment', 'transfer') and deal_id = $1",
      [DEALS.nina]);
    assert.equal(Number(count), 0);
    assert.deepEqual(await records(DEALS.nina), []);
  });

  it('refuses the wrong action for the deal state', async () => {
    assert.equal((await assign(STAFF.karen, DEALS.hannah, STAFF.arjun, 'x')).status, 409); // already owned
    assert.equal((await transfer(STAFF.karen, DEALS.nina, STAFF.dana, 'x')).status, 409); // unowned
    assert.equal((await transfer(STAFF.karen, DEALS.hannah, STAFF.dana, 'x')).status, 409); // same owner
  });

  it('does not reassign a closed deal', async () => {
    // Rob's deal is lost; Dana is a valid target, so only the stage can block this.
    const { status, body } = await transfer(STAFF.karen, DEALS.rob, STAFF.dana, 'Reopen');
    assert.equal(status, 409);
    assert.match(body.error, /closed/);
    assert.equal((await dealRow(DEALS.rob)).owner_id, STAFF.arjun);
  });

  it('refuses a change made from a stale page', async () => {
    // Another GM moved Hannah to Arjun after this GM opened her record showing Dana.
    await transfer(STAFF.karen, DEALS.hannah, STAFF.arjun, 'Arjun is back on shift');
    const stale = await transfer(STAFF.karen, DEALS.hannah, STAFF.dana, 'Dana knows her',
      { expectedOwnerId: STAFF.dana });
    assert.equal(stale.status, 409);
    assert.match(stale.body.error, /now belongs to Arjun Mehta/);
    assert.equal((await dealRow(DEALS.hannah)).owner_id, STAFF.arjun);

    assert.equal((await assign(STAFF.karen, DEALS.nina, STAFF.dana, 'x', { expectedOwnerId: STAFF.arjun })).status, 409);
    assert.equal((await assign(STAFF.karen, DEALS.nina, STAFF.dana, 'x', { expectedOwnerId: 'nope' })).status, 400);
    assert.equal((await assign(STAFF.karen, DEALS.nina, STAFF.dana, 'x', { expectedOwnerId: 5 })).status, 400);
    assert.equal((await assign(STAFF.karen, DEALS.nina, STAFF.dana, 'Fresh page', { expectedOwnerId: null })).status, 200);
    assert.equal((await transfer(STAFF.karen, DEALS.hannah, STAFF.dana, 'Fresh page',
      { expectedOwnerId: STAFF.arjun })).status, 200);
  });

  it('serialises two simultaneous assignments of the same deal', async () => {
    const results = await Promise.all([
      assign(STAFF.karen, DEALS.nina, STAFF.dana, 'First'),
      assign(STAFF.karen, DEALS.nina, STAFF.arjun, 'Second'),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const [{ count }] = await api.db.query<{ count: string }>(
      "select count(*) from public.timeline_events where event_type = 'assignment' and deal_id = $1", [DEALS.nina]);
    assert.equal(Number(count), 1);
    assert.equal((await records(DEALS.nina)).length, 1);
  });
});
