import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { STAFF, DEALS } from '../src/seed-ids.ts';
import { reviewDraft, sendDraft } from '../src/reply-drafts/service.ts';
import { useApi } from './harness.ts';

describe('reply draft review (US11)', () => {
  const api = useApi();
  const create = (as = STAFF.dana as string, dealId = DEALS.maya as string, body: { requestId: string; channel: string } = { requestId: randomUUID(), channel: 'sms' }) =>
    api.call(as, 'POST', `/api/deals/${dealId}/reply-drafts`, body);
  const review = (id: string, decision: string, message?: string, as = STAFF.dana as string) =>
    api.call(as, 'POST', `/api/reply-drafts/${id}/review`, { decision, ...(message === undefined ? {} : { message }) });
  const send = (id: string, as = STAFF.dana as string) => api.call(as, 'POST', `/api/reply-drafts/${id}/send`);
  const list = (as = STAFF.dana as string, dealId = DEALS.maya as string) => api.call(as, 'GET', `/api/deals/${dealId}/reply-drafts`);
  const due = async () => (await api.call(STAFF.dana, 'GET', `/api/deals/${DEALS.maya}/follow-up`)).body.status;
  const history = () => api.db.query('select * from public.timeline_events order by id');

  it('creates a template draft with server-derived context without contacting the customer', async () => {
    const before = await history();
    const result = await create();
    assert.equal(result.status, 200);
    assert.equal(result.body.source, 'simulated_template');
    assert.equal(result.body.decision, null);
    assert.equal(result.body.context.buyer, 'Maya Desai');
    assert.ok(result.body.context.messages.some((m: { body: string }) => m.body.includes("You're all set")));
    assert.ok(result.body.context.reasons.length > 0);
    assert.match(result.body.originalText, /Dana Kowalski/);
    assert.equal(result.body.finalText, null);
    assert.equal((await list()).body.length, 1);
    assert.equal(await due(), 'due');
    assert.deepEqual(await history(), before);
  });

  it('saves approval and original text on the timeline before a separate simulated send', async () => {
    const draft = (await create()).body;
    const reviewed = await review(draft.id, 'approve');
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.finalText, draft.originalText);
    assert.equal(reviewed.body.reviewedBy, STAFF.dana);
    assert.equal(await due(), 'due', 'Review is not contact');
    const [event] = await api.db.query<{ event_type: string; body: string; actor_id: string }>('select event_type, body, actor_id from public.timeline_events where id = $1', [reviewed.body.reviewEventId]);
    assert.equal(event.event_type, 'draft_review');
    assert.equal(event.actor_id, STAFF.dana);
    assert.ok(event.body.includes(draft.originalText));
    const sent = await send(draft.id);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.status, 'simulated_sent');
    assert.equal(sent.body.draft.sentEventId, sent.body.eventId);
    assert.equal(sent.body.followUp.status, 'not_due');
    assert.equal((await list()).body[0].sentEventId, sent.body.eventId);
  });

  it('saves edited text and decision, and sends only that saved text', async () => {
    const draft = (await create()).body;
    const text = 'Hi Maya, Dana here. What questions can I answer after your visit?';
    assert.equal((await review(draft.id, 'edit', '  ' + text + '  ')).status, 200);
    const sent = await api.call(STAFF.dana, 'POST', `/api/reply-drafts/${draft.id}/send`, { message: 'Unreviewed replacement', channel: 'email' });
    assert.equal(sent.body.message, text);
    assert.equal(sent.body.channel, 'sms');
    const stored = (await list()).body[0];
    assert.equal(stored.originalText, draft.originalText);
    assert.equal(stored.finalText, text);
    assert.equal(stored.decision, 'edit');
    const [event] = await api.db.query<{ body: string }>('select body from public.timeline_events where id = $1', [stored.reviewEventId]);
    assert.ok(event.body.includes('edited and approved'));
    assert.ok(event.body.includes(text));
  });

  it('records a rejection but prevents sending or changing the decision afterward', async () => {
    const draft = (await create()).body;
    assert.equal((await send(draft.id)).status, 409, 'Pending drafts cannot be sent');
    const rejected = await review(draft.id, 'reject');
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.finalText, null);
    assert.equal((await send(draft.id)).status, 409);
    assert.equal((await review(draft.id, 'approve')).status, 409);
    assert.equal(await due(), 'due');
    const [event] = await api.db.query<{ body: string }>('select body from public.timeline_events where id = $1', [rejected.body.reviewEventId]);
    assert.match(event.body, /rejected/);
    assert.ok(event.body.includes(draft.originalText));
    assert.equal((await list()).body[0].sentEventId, null);
  });

  it('deduplicates creation, review and concurrent send retries', async () => {
    const body = { requestId: randomUUID(), channel: 'sms' };
    const created = await Promise.all([create(STAFF.dana, DEALS.maya, body), create(STAFF.dana, DEALS.maya, body)]);
    assert.ok(created.every(r => r.status === 200));
    assert.equal((await list()).body.length, 1);
    const id = created[0].body.id;
    const reviews = await Promise.all([review(id, 'approve'), review(id, 'approve')]);
    assert.equal(reviews[0].body.reviewEventId, reviews[1].body.reviewEventId);
    const sends = await Promise.all([send(id), send(id)]);
    assert.ok(sends.every(r => r.status === 200));
    assert.equal(sends[0].body.eventId, sends[1].body.eventId);
    assert.equal((await api.db.query('select id from public.timeline_events where id = $1', [id])).length, 1);
    assert.equal((await review(id, 'edit', 'Changed after sending')).status, 409);
  });

  it('enforces current deal ownership, including after a transfer', async () => {
    const draft = (await create()).body;
    for (const path of [`/api/deals/${DEALS.maya}/reply-drafts`, `/api/reply-drafts/${draft.id}/review`, `/api/reply-drafts/${draft.id}/send`]) {
      const method = path.endsWith('reply-drafts') ? 'GET' : 'POST';
      assert.equal((await api.call(STAFF.arjun, method, path, method === 'POST' ? { decision: 'approve' } : undefined)).status, 403);
      assert.equal((await api.call(null, method, path, method === 'POST' ? { decision: 'approve' } : undefined)).status, 401);
    }
    assert.equal((await create(STAFF.arjun)).status, 403);
    await api.call(STAFF.karen, 'POST', `/api/deals/${DEALS.maya}/transfer`, { toUserId: STAFF.arjun, reason: 'Dana is away' });
    assert.equal((await review(draft.id, 'approve')).status, 403);
    assert.equal((await list(STAFF.arjun)).body.length, 1);
    assert.equal((await review(draft.id, 'approve', undefined, STAFF.arjun)).status, 200);
    assert.equal((await send(draft.id, STAFF.arjun)).status, 200);
  });

  it('rechecks opt-out and eligibility after approval, and can still reject an obsolete pending draft', async () => {
    const draft = (await create()).body;
    await review(draft.id, 'approve');
    const pending = (await create()).body;
    await api.db.query('update public.buyers set opted_out = true where id = (select buyer_id from public.deals where id = $1)', [DEALS.maya]);
    const before = await history();
    assert.equal((await send(draft.id)).status, 409);
    assert.equal((await review(pending.id, 'approve')).status, 409);
    assert.deepEqual(await history(), before);
    assert.equal((await review(pending.id, 'reject')).status, 200);
  });

  it('blocks creation for closed/not-due/opted-out deals and channels without contact details', async () => {
    for (const deal of [DEALS.rob, DEALS.chris, DEALS.jordan, DEALS.marcus]) assert.equal((await create(STAFF.karen, deal)).status, 409);
    assert.equal((await create(STAFF.dana, DEALS.maya, { requestId: randomUUID(), channel: 'email' })).status, 400);
    assert.equal((await create(STAFF.dana, DEALS.maya, { requestId: randomUUID(), channel: 'call' })).status, 400);
    assert.equal((await create(STAFF.dana, DEALS.maya, { requestId: 'bad', channel: 'sms' })).status, 400);
    assert.equal((await create(STAFF.dana, 'ffffffff-ffff-ffff-ffff-ffffffffffff')).status, 404);
    assert.equal((await create(STAFF.dana, DEALS.maya, { requestId: '40000000-0000-0000-0000-000000000002', channel: 'sms' })).status, 409);
  });

  it('validates edits and decisions without changing the pending draft', async () => {
    const draft = (await create()).body;
    for (const text of ['', '   ', 'x'.repeat(2001), draft.originalText]) assert.equal((await review(draft.id, 'edit', text)).status, 400);
    assert.equal((await review(draft.id, 'approve', 'Changed text')).status, 400);
    assert.equal((await review(draft.id, 'unknown')).status, 400);
    assert.equal((await review('not-a-uuid', 'reject')).status, 400);
    assert.equal((await review('ffffffff-ffff-ffff-ffff-ffffffffffff', 'reject')).status, 404);
    assert.equal((await list()).body[0].decision, null);
  });

  it('rolls back timeline writes when saving the review or sent link fails', async () => {
    const draft = (await create()).body;
    const original = api.db.transaction.bind(api.db);
    const failure = Error('Injected draft update failure');
    const installFailure = () => {
      api.db.transaction = work => original(tx => work({
        async query<Row>(sql: string, params?: unknown[]): Promise<Row[]> {
          if (sql.includes('update public.reply_drafts')) throw failure;
          return tx.query<Row>(sql, params);
        },
      }));
    };
    const staff = { id: STAFF.dana, name: 'Dana', role: 'rep' as const };
    const before = await history();
    installFailure();
    await assert.rejects(reviewDraft(api.db, staff, draft.id, { decision: 'approve' }), e => e === failure);
    assert.deepEqual(await history(), before);
    api.db.transaction = original;
    await review(draft.id, 'approve');
    const approvedHistory = await history();
    installFailure();
    await assert.rejects(sendDraft(api.db, staff, draft.id), e => e === failure);
    assert.deepEqual(await history(), approvedHistory);
    assert.equal((await list()).body[0].sentEventId, null);
    assert.equal(await due(), 'due');
  });

  it('rejects inconsistent stored decisions and cross-deal review links', async () => {
    const draft = (await create()).body;
    await assert.rejects(api.db.query("update public.reply_drafts set decision='approve' where id=$1", [draft.id]), (e: any) => e.code === '23514');
    await assert.rejects(api.db.query("update public.reply_drafts set sent_event_id=$2 where id=$1", [draft.id, '40000000-0000-0000-0000-000000000012']), (e: any) => e.code === '23514');
    await assert.rejects(api.db.query(`update public.reply_drafts set decision='reject', reviewed_by=$2,
      reviewed_at=now(), review_event_id=$3 where id=$1`, [draft.id, STAFF.dana, '40000000-0000-0000-0000-000000000007']), (e: any) => e.code === '23503');
  });
});
