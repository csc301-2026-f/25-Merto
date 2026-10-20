import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEALS, STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

describe('deal list and buyer record', () => {
  const api = useApi();
  const { call } = api;
  const ids = (list: { dealId: string }[]) => list.map((deal) => deal.dealId);
  const activeDealIds = async (ownerId: string | null) => (await api.db.query<{ id: string }>(`
    select id from public.deals where stage not in ('delivered', 'lost')
      and ($1::uuid is null or owner_id = $1) order by id`, [ownerId])).map((row) => row.id);

  it('shows the GM every open deal and a rep only their own', async () => {
    const all = await call(STAFF.karen, 'GET', '/api/deals');
    assert.equal(all.status, 200);
    assert.deepEqual(ids(all.body).sort(), await activeDealIds(null));
    assert.ok(!ids(all.body).includes(DEALS.rob), 'Lost deals are not active work');
    const nina = all.body.find((deal: { dealId: string }) => deal.dealId === DEALS.nina);
    assert.deepEqual([nina.owner, nina.openItems, nina.optedOut], [null, 1, false]);

    const dana = await call(STAFF.dana, 'GET', '/api/deals');
    assert.deepEqual(ids(dana.body).sort(), await activeDealIds(STAFF.dana));
    assert.ok(dana.body.every((deal: { ownerId: string }) => deal.ownerId === STAFF.dana));
    assert.equal((await call(null, 'GET', '/api/deals')).status, 401);
  });

  it('moves a deal from one rep\'s list to the other\'s on transfer', async () => {
    await call(STAFF.karen, 'POST', `/api/deals/${DEALS.hannah}/transfer`,
      { toUserId: STAFF.arjun, reason: 'Arjun is back on shift' });
    assert.ok(!ids((await call(STAFF.dana, 'GET', '/api/deals')).body).includes(DEALS.hannah));
    assert.ok(ids((await call(STAFF.arjun, 'GET', '/api/deals')).body).includes(DEALS.hannah));
  });

  it('labels every timeline entry with who acted', async () => {
    const record = await call(STAFF.karen, 'GET', `/api/deals/${DEALS.jordan}`);
    assert.equal(record.status, 200);
    assert.equal(record.body.buyer.name, 'Jordan Lee');
    assert.deepEqual(record.body.owner, { id: STAFF.dana, name: 'Dana Kowalski' });
    assert.deepEqual(record.body.timeline.map((entry: { actorType: string; actorName: string | null }) =>
      [entry.actorType, entry.actorName]), [
      ['buyer', null], ['ai', null], ['gm', 'Karen Holt'], ['rep', 'Dana Kowalski'],
    ]);
    assert.deepEqual(record.body.appointments.map((visit: { status: string; confirmedBy: string }) =>
      [visit.status, visit.confirmedBy]), [['confirmed', 'Dana Kowalski']]);
    assert.deepEqual(record.body.openItems.map((item: { status: string }) => item.status), ['open', 'resolved']);
    assert.equal(record.body.assignments.length, 1);
  });

  it('gives the new owner the full history after a transfer, and the old owner none', async () => {
    const before = (await call(STAFF.dana, 'GET', `/api/deals/${DEALS.hannah}`)).body;
    // Arjun's own note from before the first transfer is part of Dana's record.
    assert.ok(before.timeline.some((entry: { actorName: string }) => entry.actorName === 'Arjun Mehta'));

    await call(STAFF.karen, 'POST', `/api/deals/${DEALS.hannah}/transfer`,
      { toUserId: STAFF.arjun, reason: 'Arjun is back on shift' });
    const after = await call(STAFF.arjun, 'GET', `/api/deals/${DEALS.hannah}`);
    assert.equal(after.status, 200);
    assert.deepEqual(after.body.timeline.slice(0, -1), before.timeline, 'Nothing earlier changed');
    assert.equal(after.body.timeline.at(-1).eventType, 'transfer');
    assert.deepEqual(after.body.openItems.map((item: { owner: string }) => item.owner), ['Arjun Mehta']);
    assert.equal(after.body.assignments.at(-1).reason, 'Arjun is back on shift');
    assert.equal((await call(STAFF.dana, 'GET', `/api/deals/${DEALS.hannah}`)).status, 403);
  });

  it('checks access and IDs on the server', async () => {
    assert.equal((await call(STAFF.arjun, 'GET', `/api/deals/${DEALS.jordan}`)).status, 403);
    assert.equal((await call(STAFF.karen, 'GET', '/api/deals/ffffffff-ffff-ffff-ffff-ffffffffffff')).status, 404);
    assert.equal((await call(STAFF.karen, 'GET', '/api/deals/not-a-uuid')).status, 400);
    // The unassigned list is not mistaken for a deal ID.
    assert.equal((await call(STAFF.karen, 'GET', '/api/deals/unassigned')).status, 200);
  });
});

describe('adding a buyer', () => {
  const api = useApi();
  const { call } = api;
  const add = (as: string | null, body: unknown) => call(as, 'POST', '/api/deals', body as object);
  const walkIn = { name: 'Lena Novak', phone: '647-555-0987', vehicleInterest: '2022 Toyota Corolla', source: 'walk_in' };
  const counts = async () => Promise.all(['buyers', 'deals', 'timeline_events', 'deal_assignments'].map(async (table) =>
    // Table names come only from the fixed list above.
    (await api.db.query(`select id from public.${table}`)).length));
  type Row = Record<string, any>;

  it('lets a GM add a buyer, who then waits in the unassigned list', async () => {
    const created = await add(STAFF.karen, { ...walkIn, email: ' Lena.Walkin@Example.com ' });
    assert.equal(created.status, 201);
    assert.equal(created.body.owner, null);
    assert.equal(created.body.stage, 'new');
    assert.deepEqual(created.body.buyer, {
      id: created.body.buyer.id, name: 'Lena Novak', email: 'lena.walkin@example.com', phone: '647-555-0987',
      preferredChannel: 'email', optedOut: false, existing: false,
    });
    assert.deepEqual(created.body.otherOpenDeals, []);
    const unassigned = (await call(STAFF.karen, 'GET', '/api/deals/unassigned')).body;
    assert.ok(unassigned.some((deal: Row) => deal.dealId === created.body.dealId));

    const record = (await call(STAFF.karen, 'GET', `/api/deals/${created.body.dealId}`)).body;
    assert.deepEqual([record.vehicleInterest, record.source], ['2022 Toyota Corolla', 'walk_in']);
    assert.deepEqual(record.timeline.map((entry: Row) => [entry.actorType, entry.actorName, entry.body]), [
      ['gm', 'Karen Holt', 'Karen Holt added Lena Novak: interested in 2022 Toyota Corolla (source: walk in).'],
    ]);
    assert.deepEqual(record.assignments, []);

    // From here it is an ordinary unassigned buyer for US8.
    const assigned = await call(STAFF.karen, 'POST', `/api/deals/${created.body.dealId}/assign`,
      { toUserId: STAFF.dana, reason: "Walk-in during Dana's shift" });
    assert.equal(assigned.status, 200);
  });

  it('gives a rep the buyer they add, with an ownership record', async () => {
    const created = await add(STAFF.dana, walkIn);
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.owner, { id: STAFF.dana, name: 'Dana Kowalski' });
    assert.equal(created.body.stage, 'assigned');
    assert.equal(created.body.buyer.preferredChannel, 'sms', 'Phone only, so not email');
    assert.ok((await call(STAFF.dana, 'GET', '/api/deals')).body.some((deal: Row) => deal.dealId === created.body.dealId));

    const history = (await call(STAFF.dana, 'GET', `/api/deals/${created.body.dealId}/assignments`)).body.history;
    assert.deepEqual(history.map((entry: Row) => [entry.kind, entry.by.name, entry.from, entry.to.name, entry.reason, entry.structured]),
      [['assignment', 'Dana Kowalski', null, 'Dana Kowalski', 'New buyer added by this rep', true]]);
    const [event] = await api.db.query<Row>('select actor_type, event_type from public.timeline_events where id = $1',
      [created.body.eventId]);
    assert.deepEqual(event, { actor_type: 'rep', event_type: 'assignment' });
    assert.equal((await call(STAFF.arjun, 'GET', `/api/deals/${created.body.dealId}`)).status, 403);
  });

  it('reuses a buyer already on file, matched by email or by phone digits', async () => {
    const before = await counts();
    const byEmail = await add(STAFF.karen, {
      name: 'J. Lee', email: 'JORDAN@example.com', phone: '(905) 555 0100', vehicleInterest: 'Honda Civic', source: 'website',
    });
    assert.equal(byEmail.status, 201);
    // Jordan keeps his name; his missing phone is filled in; his open RAV4 deal is listed.
    assert.deepEqual([byEmail.body.buyer.name, byEmail.body.buyer.phone, byEmail.body.buyer.existing],
      ['Jordan Lee', '(905) 555 0100', true]);
    assert.deepEqual(byEmail.body.otherOpenDeals.map((deal: Row) => [deal.dealId, deal.owner]),
      [[DEALS.jordan, 'Dana Kowalski']]);

    const byPhone = await add(STAFF.karen, { name: 'Jordan', phone: '905-555-0100', vehicleInterest: 'Kia Soul', source: 'phone' });
    assert.equal(byPhone.body.buyer.id, byEmail.body.buyer.id);
    assert.equal(byPhone.body.buyer.email, 'jordan@example.com', 'Existing details are never overwritten');
    assert.deepEqual(await counts(), [before[0], before[1] + 2, before[2] + 2, before[3]]);
  });

  it('refuses an email and phone that belong to two different buyers', async () => {
    await add(STAFF.karen, walkIn);
    const before = await counts();
    const mixed = await add(STAFF.karen, { ...walkIn, email: 'jordan@example.com', phone: '647 555 0987' });
    assert.equal(mixed.status, 409);
    assert.match(mixed.body.error, /Jordan Lee/);
    assert.deepEqual(await counts(), before);
  });

  it('adds a deal for a buyer who opted out, and says so', async () => {
    const rob = await add(STAFF.karen, { name: 'Rob', email: 'rob@example.com', vehicleInterest: 'Mazda CX-50', source: 'walk_in' });
    assert.equal(rob.status, 201);
    assert.deepEqual([rob.body.buyer.name, rob.body.buyer.optedOut, rob.body.buyer.existing], ['Rob Lindqvist', true, true]);
    assert.deepEqual(rob.body.otherOpenDeals, [], 'His lost deal is not open');
  });

  it('creates one buyer when the same new person is added twice at once', async () => {
    const before = await counts();
    const results = await Promise.all([add(STAFF.karen, walkIn), add(STAFF.dana, walkIn)]);
    assert.deepEqual(results.map((result) => result.status), [201, 201]);
    assert.equal(results[0].body.buyer.id, results[1].body.buyer.id);
    assert.equal((await counts())[0], before[0] + 1);
  });

  it('rejects incomplete or invalid details without writing anything', async () => {
    const before = await counts();
    for (const [body, error] of [
      [{ ...walkIn, name: '  ' }, /name is required/],
      [{ ...walkIn, name: 5 }, /name must be a string/],
      [{ ...walkIn, name: 'x'.repeat(201) }, /at most 200/],
      [{ ...walkIn, vehicleInterest: undefined }, /vehicleInterest is required/],
      [{ ...walkIn, source: 'Web Chat' }, /source must be one of/],
      [{ ...walkIn, phone: undefined }, /email or a phone/],
      [{ ...walkIn, email: 'not-an-email' }, /valid address/],
      [{ ...walkIn, phone: 'call me' }, /only contain digits/],
      [{ ...walkIn, phone: '555-01' }, /at least 7 digits/],
      [{ ...walkIn, preferredChannel: 'email' }, /needs an email/],
      [{ ...walkIn, preferredChannel: 'fax' }, /preferredChannel must be one of/],
      [[walkIn], /name is required/],
    ] as const) {
      const result = await add(STAFF.karen, body);
      assert.equal(result.status, 400, JSON.stringify(body));
      assert.match(result.body.error, error);
    }
    assert.equal((await add(null, walkIn)).status, 401);
    assert.deepEqual(await counts(), before);
  });
});

describe('development sign-in', () => {
  const api = useApi({ devLoginPassword: 'test' });
  const login = (body: object) => api.call(null, 'POST', '/auth/login', body);

  it('returns the staff ID to send as X-Staff-Id and the role from the database', async () => {
    const karen = await login({ username: 'karen', password: 'test' });
    assert.equal(karen.status, 200);
    assert.deepEqual(karen.body, { token: STAFF.karen, id: STAFF.karen, name: 'Karen Holt', role: 'gm' });
    const dana = await login({ username: ' Dana@Example.com ', password: 'test' });
    assert.deepEqual([dana.body.token, dana.body.role], [STAFF.dana, 'rep']);

    const me = await api.call(dana.body.token, 'GET', '/api/me');
    assert.deepEqual(me.body, { id: STAFF.dana, name: 'Dana Kowalski', role: 'rep' });
  });

  it('refuses wrong or missing credentials', async () => {
    assert.equal((await login({ username: 'karen', password: 'wrong' })).status, 401);
    assert.equal((await login({ username: 'nobody', password: 'test' })).status, 401);
    assert.equal((await login({ username: 'karen' })).status, 400);
    assert.equal((await login({ username: '  ', password: 'test' })).status, 400);
    assert.equal((await login({ username: ['karen'], password: 'test' })).status, 400);
  });
});

describe('development sign-in when no password is set', () => {
  const api = useApi();

  it('is turned off', async () => {
    const result = await api.call(null, 'POST', '/auth/login', { username: 'karen', password: 'test' });
    assert.equal(result.status, 404);
    assert.equal((await api.call(null, 'GET', '/api/me')).status, 401);
  });
});
