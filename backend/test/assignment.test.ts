import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.ts';
import { assignmentBody, parseReason } from '../src/assignment/policy.ts';
import type { Database } from '../src/db.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';
import { DEALS, STAFF } from '../src/seed-ids.ts';

// Ports the Fetch standard blocks above 1023.
const FETCH_BLOCKED_PORTS = new Set([1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

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
  let db: Database;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await sandboxDatabase();
    // fetch refuses some ports (e.g. 6000, 10080); retry when listen(0) picks one.
    for (;;) {
      server = createApp(db).listen(0);
      await new Promise((resolve) => server.once('listening', resolve));
      if (!FETCH_BLOCKED_PORTS.has((server.address() as AddressInfo).port)) break;
      server.close();
    }
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

  const assign = (as: string, dealId: string, toUserId: string, reason?: string) =>
    call(as, 'POST', `/api/deals/${dealId}/assign`, { toUserId, reason });
  const transfer = (as: string, dealId: string, toUserId: string, reason?: string) =>
    call(as, 'POST', `/api/deals/${dealId}/transfer`, { toUserId, reason });
  const dealRow = async (dealId: string) =>
    (await db.query<{ owner_id: string | null; stage: string }>(
      'select owner_id, stage from public.deals where id = $1', [dealId]))[0];

  it('lists unassigned buyers for the GM only, oldest first', async () => {
    const list = await call(STAFF.karen, 'GET', '/api/deals/unassigned');
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.map((deal: { buyer: string }) => deal.buyer), ['Nina Shah', 'Ben Okafor']);
    assert.equal((await call(STAFF.dana, 'GET', '/api/deals/unassigned')).status, 403);
    assert.equal((await call(null, 'GET', '/api/deals/unassigned')).status, 401);
  });

  it('assigns an unassigned buyer: owner, stage, open item and timeline', async () => {
    const { status, body } = await assign(STAFF.karen, DEALS.nina, STAFF.dana, 'Buyer asked for Dana');
    assert.equal(status, 200);
    assert.equal(body.from, null);
    assert.equal(body.to.name, 'Dana Kowalski');
    assert.equal(body.openItemsMoved, 1);
    assert.deepEqual(await dealRow(DEALS.nina), { owner_id: STAFF.dana, stage: 'assigned' });

    const [item] = await db.query<{ owner_id: string }>(
      "select owner_id from public.open_items where deal_id = $1 and status = 'open'", [DEALS.nina]);
    assert.equal(item.owner_id, STAFF.dana);

    const history = (await call(STAFF.karen, 'GET', `/api/deals/${DEALS.nina}/assignments`)).body;
    assert.equal(history.currentOwner.name, 'Dana Kowalski');
    const [event] = history.history;
    assert.equal(event.eventType, 'assignment');
    assert.equal(event.actorId, STAFF.karen);
    assert.equal(event.actor, 'Karen Holt');
    assert.equal(event.body, 'Assigned Nina Shah to Dana Kowalski: Buyer asked for Dana');

    // Now owned, so the buyer leaves the unassigned list and Dana can read the history.
    const unassigned = (await call(STAFF.karen, 'GET', '/api/deals/unassigned')).body;
    assert.deepEqual(unassigned.map((deal: { buyer: string }) => deal.buyer), ['Ben Okafor']);
    assert.equal((await call(STAFF.dana, 'GET', `/api/deals/${DEALS.nina}/assignments`)).status, 200);
  });

  it('keeps the stage when assigning a deal that is already past new', async () => {
    assert.equal((await assign(STAFF.karen, DEALS.ben, STAFF.arjun, 'Round robin')).status, 200);
    assert.deepEqual(await dealRow(DEALS.ben), { owner_id: STAFF.arjun, stage: 'engaged' });
  });

  it('transfers a deal and keeps all history attached', async () => {
    const before = {
      events: (await db.query('select id from public.timeline_events where deal_id = $1', [DEALS.hannah])).length,
      appointments: (await db.query('select id from public.appointments where deal_id = $1', [DEALS.hannah])).length,
      items: (await db.query('select id from public.open_items where deal_id = $1', [DEALS.hannah])).length,
    };
    const { status, body } = await transfer(STAFF.karen, DEALS.hannah, STAFF.arjun, 'Arjun is back on shift');
    assert.equal(status, 200);
    assert.equal(body.from.name, 'Dana Kowalski');
    assert.equal(body.to.name, 'Arjun Mehta');
    assert.equal((await dealRow(DEALS.hannah)).owner_id, STAFF.arjun);
    assert.equal((await dealRow(DEALS.hannah)).stage, 'working');

    const after = {
      events: (await db.query('select id from public.timeline_events where deal_id = $1', [DEALS.hannah])).length,
      appointments: (await db.query('select id from public.appointments where deal_id = $1', [DEALS.hannah])).length,
      items: (await db.query('select id from public.open_items where deal_id = $1', [DEALS.hannah])).length,
    };
    // Only the new transfer event is added; nothing is lost or duplicated.
    assert.deepEqual(after, { ...before, events: before.events + 1 });

    const history = (await call(STAFF.karen, 'GET', `/api/deals/${DEALS.hannah}/assignments`)).body.history;
    assert.deepEqual(history.map((event: { eventType: string }) => event.eventType), ['transfer', 'transfer']);
    assert.equal(history[1].body, 'Transferred Hannah Clarke from Dana Kowalski to Arjun Mehta: Arjun is back on shift');
  });

  it('moves only open items to the new owner', async () => {
    await transfer(STAFF.karen, DEALS.jordan, STAFF.arjun, 'Dana is out');
    const items = await db.query<{ status: string; owner_id: string }>(
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
    const [{ count }] = await db.query<{ count: string }>(
      "select count(*) from public.timeline_events where event_type in ('assignment', 'transfer') and deal_id = $1",
      [DEALS.nina]);
    assert.equal(Number(count), 0);
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

  it('serialises two simultaneous assignments of the same deal', async () => {
    const results = await Promise.all([
      assign(STAFF.karen, DEALS.nina, STAFF.dana, 'First'),
      assign(STAFF.karen, DEALS.nina, STAFF.arjun, 'Second'),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const [{ count }] = await db.query<{ count: string }>(
      "select count(*) from public.timeline_events where event_type = 'assignment' and deal_id = $1", [DEALS.nina]);
    assert.equal(Number(count), 1);
  });
});
