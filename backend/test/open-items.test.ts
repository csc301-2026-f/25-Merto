import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFilters } from '../src/open-items/policy.ts';
import { DEALS, STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

type Item = {
  id: string; status: string; type: string; overdue: boolean; ageHours: number | null;
  createdAt: string; resolvedAt: string | null; owner: { id: string } | null;
  deal: { id: string; owner: { id: string } | null };
};

describe('open item filters', () => {
  it('defaults to unresolved work and accepts the documented filters', () => {
    assert.deepEqual(parseFilters({}), { status: 'open', type: null, owner: null });
    assert.deepEqual(parseFilters({ status: 'all', type: 'missing_doc', ownerId: 'none' }),
      { status: null, type: 'missing_doc', owner: 'none' });
  });

  it('rejects bad values instead of ignoring them', () => {
    assert.throws(() => parseFilters({ status: 'done' }), /status must be one of/);
    assert.throws(() => parseFilters({ type: 'task' }), /type must be one of/);
    assert.throws(() => parseFilters({ ownerId: 'dana' }), /ownerId/);
    assert.throws(() => parseFilters({ status: ['open', 'resolved'] }), /single value/);
  });
});

describe('open items overview (US4)', () => {
  const api = useApi();
  const { call } = api;
  const get = (as: string | null, query = '') => call(as, 'GET', `/api/open-items${query}`);
  // What the database says is unresolved on a deal that is still being worked.
  const activeOpen = (ownerId: string | null) => api.db.query<{ id: string }>(`
    select i.id from public.open_items i join public.deals d on d.id = i.deal_id
    where i.status = 'open' and d.stage not in ('delivered', 'lost')
      and ($1::uuid is null or d.owner_id = $1) order by i.id`, [ownerId]);
  const ids = (items: Item[]) => items.map((item) => item.id).sort();

  it('needs a known staff member', async () => {
    assert.equal((await get(null)).status, 401);
  });

  it('shows the GM all unresolved work, oldest first, with enough context', async () => {
    const { status, body } = await get(STAFF.karen);
    assert.equal(status, 200);
    assert.deepEqual(ids(body.items), (await activeOpen(null)).map((row) => row.id).sort());
    assert.ok(body.items.length > 0);
    assert.ok(body.items.every((item: Item) => item.status === 'open'));

    const created = body.items.map((item: Item) => Date.parse(item.createdAt));
    assert.deepEqual(created, [...created].sort((a, b) => a - b), 'longest-waiting item first');

    const [item] = body.items.filter((row: Item) => row.deal.id === DEALS.hannah);
    assert.equal(item.type, 'promise');
    assert.match(item.description, /CR-V lease quote/);
    assert.equal(item.deal.buyer, 'Hannah Clarke');
    assert.equal(item.deal.owner.id, STAFF.dana);
    assert.equal(item.owner.id, STAFF.dana);
    assert.ok(item.ageHours >= 24);
  });

  it('marks items past their due time as overdue', async () => {
    const items: Item[] = (await get(STAFF.karen)).body.items;
    const byDeal = (dealId: string) => items.find((item) => item.deal.id === dealId)!;
    assert.equal(byDeal(DEALS.hannah).overdue, true); // quote was due an hour ago
    assert.equal(byDeal(DEALS.jordan).overdue, false); // trade-in estimate due in two hours
  });

  it('summarises unresolved work and counts unowned items', async () => {
    const { summary, items } = (await get(STAFF.karen)).body;
    assert.equal(summary.open, items.length);
    assert.equal(summary.overdue, items.filter((item: Item) => item.overdue).length);
    assert.equal(summary.unowned, items.filter((item: Item) => item.owner === null).length);
    assert.ok(summary.unowned >= 1, "Nina's callback has no owner yet");
    assert.equal(summary.byType.reduce((sum: number, row: { open: number }) => sum + row.open, 0), summary.open);
    assert.equal(summary.oldestCreatedAt, items[0].createdAt);
  });

  it('shows a rep only items on their own deals', async () => {
    const dana = await get(STAFF.dana);
    assert.equal(dana.status, 200);
    assert.deepEqual(ids(dana.body.items), (await activeOpen(STAFF.dana)).map((row) => row.id).sort());
    assert.ok(dana.body.items.every((item: Item) => item.deal.owner?.id === STAFF.dana));
    assert.equal(dana.body.summary.open, dana.body.items.length);
    // Nina is unassigned, so her callback is not on any rep's list.
    assert.ok(!dana.body.items.some((item: Item) => item.deal.id === DEALS.nina));
  });

  it('follows the deal when it is transferred', async () => {
    const before = (await get(STAFF.arjun)).body.items.map((item: Item) => item.deal.id);
    assert.ok(!before.includes(DEALS.hannah));
    await call(STAFF.karen, 'POST', `/api/deals/${DEALS.hannah}/transfer`,
      { toUserId: STAFF.arjun, reason: 'Arjun is back on shift' });
    const arjun = (await get(STAFF.arjun)).body.items;
    const quote = arjun.find((item: Item) => item.deal.id === DEALS.hannah);
    assert.equal(quote.owner.id, STAFF.arjun);
    assert.ok(!(await get(STAFF.dana)).body.items.some((item: Item) => item.deal.id === DEALS.hannah));
  });

  it('tells resolved items apart from unresolved ones', async () => {
    const resolved = (await get(STAFF.karen, '?status=resolved')).body;
    assert.ok(resolved.items.length > 0);
    assert.ok(resolved.items.every((item: Item) => item.status === 'resolved'
      && item.resolvedAt !== null && item.ageHours === null && item.overdue === false));
    // The summary still counts what is unresolved, not what is listed.
    assert.equal(resolved.summary.open, (await activeOpen(null)).length);

    const all = (await get(STAFF.karen, '?status=all')).body.items as Item[];
    const firstClosed = all.findIndex((item) => item.status !== 'open');
    assert.ok(firstClosed > 0);
    assert.ok(all.slice(0, firstClosed).every((item) => item.status === 'open'));
    assert.ok(all.slice(firstClosed).every((item) => item.status !== 'open'), 'open items come first');
  });

  it('moves an item out of the unresolved list once it is resolved', async () => {
    const [{ id }] = (await get(STAFF.karen)).body.items.filter((item: Item) => item.deal.id === DEALS.hannah);
    await api.db.query("update public.open_items set status = 'resolved', resolved_at = now() where id = $1", [id]);
    assert.ok(!(await get(STAFF.karen)).body.items.some((item: Item) => item.id === id));
    assert.ok((await get(STAFF.karen, '?status=resolved')).body.items.some((item: Item) => item.id === id));
  });

  it('leaves out work on delivered or lost deals', async () => {
    await api.db.query(`insert into public.open_items (deal_id, owner_id, type, description)
      values ($1, $2, 'callback', 'Stale task on a lost deal')`, [DEALS.rob, STAFF.arjun]);
    const all = (await get(STAFF.karen, '?status=all')).body.items as Item[];
    assert.ok(!all.some((item) => item.deal.id === DEALS.rob));
    assert.ok(!(await get(STAFF.arjun, '?status=all')).body.items.some((item: Item) => item.deal.id === DEALS.rob));
  });

  it('filters by type and by owner, including items nobody owns', async () => {
    const callbacks = (await get(STAFF.karen, '?type=callback')).body;
    assert.ok(callbacks.items.length > 0);
    assert.ok(callbacks.items.every((item: Item) => item.type === 'callback'));
    assert.equal(callbacks.summary.byType.length, 1);

    const unowned = (await get(STAFF.karen, '?ownerId=none')).body;
    assert.ok(unowned.items.some((item: Item) => item.deal.id === DEALS.nina));
    assert.ok(unowned.items.every((item: Item) => item.owner === null));

    const danas = (await get(STAFF.karen, `?ownerId=${STAFF.dana}`)).body;
    assert.ok(danas.items.every((item: Item) => item.owner?.id === STAFF.dana));
  });

  it('reports an empty result as zero items and no oldest date, not an error', async () => {
    const { status, body } = await get(STAFF.karen, '?ownerId=ffffffff-ffff-ffff-ffff-ffffffffffff');
    assert.equal(status, 200);
    assert.deepEqual(body.items, []);
    assert.deepEqual(body.summary, { open: 0, overdue: 0, unowned: 0, oldestCreatedAt: null, byType: [] });
  });

  it('rejects bad filters with 400', async () => {
    for (const query of ['?status=done', '?type=task', '?ownerId=dana', '?status=open&status=all']) {
      assert.equal((await get(STAFF.karen, query)).status, 400, query);
    }
  });
});

describe('closing an open item (US4)', () => {
  const api = useApi();
  const { call } = api;
  const close = (as: string | null, id: string, action: 'resolve' | 'cancel', body?: object) =>
    call(as, 'POST', `/api/open-items/${id}/${action}`, body);
  const itemOn = async (dealId: string) => {
    const [row] = await api.db.query<{ id: string }>(
      "select id from public.open_items where deal_id = $1 and status = 'open' order by created_at limit 1", [dealId]);
    return row.id;
  };
  const reasonCodes = async (dealId: string) =>
    (await call(STAFF.karen, 'GET', `/api/deals/${dealId}/follow-up`)).body.reasons.map((r: { code: string }) => r.code);

  it('lets the owning rep resolve an item and records who, when, and how on the timeline', async () => {
    const id = await itemOn(DEALS.hannah);
    const { status, body } = await close(STAFF.dana, id, 'resolve', { note: '  Emailed the\nlease quote. ' });
    assert.equal(status, 200);
    assert.equal(body.status, 'resolved');
    assert.equal(body.note, 'Emailed the lease quote.');
    assert.equal(body.by.id, STAFF.dana);
    assert.equal(body.resolvedAt, body.at);

    const record = (await call(STAFF.dana, 'GET', `/api/deals/${DEALS.hannah}`)).body;
    assert.equal(record.openItems.find((item: { id: string }) => item.id === id).status, 'resolved');
    const event = record.timeline.find((entry: { id: string }) => entry.id === body.eventId);
    assert.equal(event.eventType, 'open_item');
    assert.equal(event.actorType, 'rep');
    assert.equal(event.actorName, 'Dana Kowalski');
    assert.match(event.body, /^Resolved promise for Hannah Clarke: .*CR-V lease quote.* Note: Emailed the lease quote\.$/);

    assert.ok(!(await call(STAFF.karen, 'GET', '/api/open-items')).body.items.some((item: Item) => item.id === id));
  });

  it('clears an overdue promise from the follow-up list once it is resolved', async () => {
    assert.ok((await reasonCodes(DEALS.hannah)).includes('overdue_commitment'));
    await close(STAFF.dana, await itemOn(DEALS.hannah), 'resolve');
    assert.ok(!(await reasonCodes(DEALS.hannah)).includes('overdue_commitment'));
  });

  it('does not count closing an item as replying to the buyer', async () => {
    const before = await reasonCodes(DEALS.nina);
    assert.ok(before.includes('unanswered_message') && before.includes('overdue_commitment'));
    assert.equal((await close(STAFF.karen, await itemOn(DEALS.nina), 'cancel', { note: 'Buyer prefers email' })).status, 200);
    assert.deepEqual(await reasonCodes(DEALS.nina), ['unanswered_message']);
  });

  it('requires a reason to cancel and keeps cancelled items without a resolved time', async () => {
    const id = await itemOn(DEALS.nina);
    assert.equal((await close(STAFF.karen, id, 'cancel')).status, 400);
    assert.equal((await close(STAFF.karen, id, 'cancel', { note: '   ' })).status, 400);
    const { body } = await close(STAFF.karen, id, 'cancel', { note: 'Duplicate of the email request' });
    assert.equal(body.status, 'cancelled');
    assert.equal(body.resolvedAt, null);
    const cancelled = (await call(STAFF.karen, 'GET', '/api/open-items?status=cancelled')).body.items;
    assert.ok(cancelled.some((item: Item) => item.id === id));
  });

  it('enforces deal ownership on the server', async () => {
    const id = await itemOn(DEALS.hannah);
    assert.equal((await close(null, id, 'resolve')).status, 401);
    assert.equal((await close(STAFF.arjun, id, 'resolve')).status, 403);
    // Nina is unassigned: only the GM can close her work.
    assert.equal((await close(STAFF.dana, await itemOn(DEALS.nina), 'resolve')).status, 403);
    assert.equal((await close(STAFF.karen, id, 'resolve')).status, 200);
  });

  it('refuses to close an item twice or on a closed deal', async () => {
    const id = await itemOn(DEALS.hannah);
    assert.equal((await close(STAFF.dana, id, 'resolve')).status, 200);
    const again = await close(STAFF.dana, id, 'cancel', { note: 'oops' });
    assert.equal(again.status, 409);
    assert.match(again.body.error, /already resolved/);

    const [{ id: stale }] = await api.db.query<{ id: string }>(`insert into public.open_items (deal_id, owner_id, type, description)
      values ($1, $2, 'callback', 'Stale task on a lost deal') returning id`, [DEALS.rob, STAFF.arjun]);
    assert.equal((await close(STAFF.karen, stale, 'resolve')).status, 409);
  });

  it('rejects bad IDs, unknown items, and bad notes without writing anything', async () => {
    const before = await api.db.query('select id from public.timeline_events');
    assert.equal((await close(STAFF.karen, 'not-a-uuid', 'resolve')).status, 400);
    assert.equal((await close(STAFF.karen, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'resolve')).status, 404);
    const id = await itemOn(DEALS.hannah);
    assert.equal((await close(STAFF.karen, id, 'resolve', { note: 42 })).status, 400);
    assert.equal((await close(STAFF.karen, id, 'resolve', { note: 'x'.repeat(501) })).status, 400);
    assert.equal((await api.db.query('select id from public.timeline_events')).length, before.length);
  });
});
