import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { groqReplyGenerator, PROMPT_VERSION, type ReplyGenerator } from '../src/reply-drafts/generator.ts';
import { createDraft } from '../src/reply-drafts/service.ts';
import { STAFF, DEALS } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

const text = 'Hi Maya, this is Dana. What questions can I help with about the Civic?';
const staff = { id: STAFF.dana, name: 'Dana', role: 'rep' as const };
const generated = { text, source: 'groq_ai' as const, model: 'test-model', promptVersion: PROMPT_VERSION };
const input = { channel: 'sms' as const, repName: 'Dana', context: {
  buyer: 'Maya', vehicleInterest: 'Civic', reasons: [], messages: [],
} };
const completion = (content: unknown = text, finish_reason = 'stop') =>
  Response.json({ choices: [{ message: { content }, finish_reason }] });

describe('Groq reply adapter (US14)', () => {
  it('sends bounded deal context to Groq with server credentials and saves provenance', async () => {
    let calls = 0;
    const generate = groqReplyGenerator({ apiKey: 'test-secret', fetch: async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-secret');
      const body = JSON.parse(init?.body as string);
      assert.equal(body.model, 'openai/gpt-oss-20b');
      assert.equal(body.max_completion_tokens, 2048);
      assert.match(body.messages[0].content, /untrusted data/);
      assert.match(body.messages[0].content, /Never invent prices/);
      assert.deepEqual(JSON.parse(body.messages[1].content), { channel: input.channel, repName: 'Dana', ...input.context });
      assert.ok(init?.signal);
      return completion();
    } });
    assert.deepEqual(await generate(input), { ...generated, model: 'openai/gpt-oss-20b' });
    assert.equal(calls, 1);
  });

  it('reports missing configuration without contacting the provider', async () => {
    const generate = groqReplyGenerator({ fetch: async () => { throw Error('must not call'); } });
    await assert.rejects(generate(input), { status: 503, message: /GROQ_API_KEY/ });
  });

  it('handles quotas, upstream failures, malformed JSON, and timeouts without leaking response bodies', async () => {
    for (const status of [429, 401, 500]) {
      const generate = groqReplyGenerator({ apiKey: 'secret', fetch: async () => new Response('private provider body', { status }) });
      await assert.rejects(generate(input), (e: any) => e.status === (status === 429 ? 429 : 503)
        && !e.message.includes('private provider body'));
    }
    await assert.rejects(groqReplyGenerator({ apiKey: 'secret', fetch: async () => new Response('bad json') })(input), { status: 502 });
    await assert.rejects(groqReplyGenerator({ apiKey: 'secret', timeoutMs: 1, fetch: async (_url, init) => {
      await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(Error('timeout')), { once: true }));
      return completion();
    } })(input), { status: 503 });
  });

  it('rejects empty, oversized, unfinished, or risky replies', async () => {
    for (const value of ['', null, 'x'.repeat(2001), 'It is still available.', "You're booked for Saturday.", 'The price is $25000.', 'Buy now!!']) {
      await assert.rejects(groqReplyGenerator({ apiKey: 'secret', fetch: async () => completion(value) })(input), { status: 502 });
    }
    await assert.rejects(groqReplyGenerator({ apiKey: 'secret', fetch: async () => completion(text, 'length') })(input), { status: 502 });
  });
});

describe('AI draft workflow (US14)', () => {
  let calls = 0;
  const generate: ReplyGenerator = async ({ context }) => {
    calls++;
    assert.equal(context.buyer, 'Maya Desai');
    assert.ok(context.messages.length > 0);
    assert.ok(context.appointments?.length);
    assert.ok(context.activityVersion);
    assert.ok(!('email' in context) && !('phone' in context));
    return generated;
  };
  const api = useApi({ replyGenerator: generate });
  const create = (requestId = randomUUID(), as: string = STAFF.dana) =>
    api.call(as, 'POST', `/api/deals/${DEALS.maya}/reply-drafts`, { requestId, channel: 'sms', context: { buyer: 'forged' } });
  const review = (id: string, decision = 'approve') => api.call(STAFF.dana, 'POST', `/api/reply-drafts/${id}/review`, { decision });
  const send = (id: string) => api.call(STAFF.dana, 'POST', `/api/reply-drafts/${id}/send`);
  const incoming = () => api.db.query(`insert into public.timeline_events (deal_id, actor_type, channel, direction, body, created_at)
    values ($1, 'buyer', 'sms', 'inbound', 'Can I visit on Saturday?', now() - interval '5 hours')`, [DEALS.maya]);

  it('persists an AI draft and context, reuses completed requests, and requires approval before simulated send', async () => {
    const before = await api.db.query('select id from public.timeline_events');
    const id = randomUUID();
    const priorCalls = calls;
    const draft = await create(id);
    assert.equal(draft.status, 200);
    assert.equal(draft.body.source, 'groq_ai');
    assert.equal(draft.body.model, 'test-model');
    assert.equal(draft.body.promptVersion, PROMPT_VERSION);
    assert.equal(draft.body.originalText, text);
    assert.equal(draft.body.decision, null);
    assert.deepEqual(await api.db.query('select id from public.timeline_events'), before);
    assert.equal((await create(id)).body.id, id);
    assert.equal(calls, priorCalls + 1);
    assert.equal((await send(id)).status, 409);
    assert.equal((await review(id)).status, 200);
    assert.equal((await send(id)).status, 200);
    assert.equal((await send(id)).body.alreadyRecorded, true);
  });

  it('does not call the model for another rep or for ineligible deals', async () => {
    const before = calls;
    assert.equal((await create(randomUUID(), STAFF.arjun)).status, 403);
    for (const deal of [DEALS.rob, DEALS.chris, DEALS.jordan, DEALS.marcus]) {
      assert.equal((await api.call(STAFF.karen, 'POST', `/api/deals/${deal}/reply-drafts`, {
        requestId: randomUUID(), channel: 'sms',
      })).status, 409);
    }
    assert.equal(calls, before);
  });

  it('blocks stale approval and sending while allowing rejection and regeneration', async () => {
    const approved = (await create()).body;
    assert.equal((await review(approved.id)).status, 200);
    const pending = (await create()).body;
    await incoming();
    assert.equal((await review(pending.id)).status, 409);
    assert.equal((await send(approved.id)).status, 409);
    assert.equal((await review(pending.id, 'reject')).status, 200);
    assert.equal((await create()).status, 200);
  });

  it('rechecks ownership, opt-out, and context after generation without holding a transaction', async () => {
    const original = api.db.transaction.bind(api.db);
    let inTransaction = false;
    api.db.transaction = work => original(async tx => {
      inTransaction = true;
      try { return await work(tx); } finally { inTransaction = false; }
    });
    await assert.rejects(createDraft(api.db, staff, DEALS.maya, { requestId: randomUUID(), channel: 'sms' }, async () => {
      assert.equal(inTransaction, false);
      await incoming();
      return generated;
    }), { status: 409 });
    await assert.rejects(createDraft(api.db, staff, DEALS.maya, { requestId: randomUUID(), channel: 'sms' }, async () => {
      await api.db.query('update public.deals set owner_id=$2 where id=$1', [DEALS.maya, STAFF.arjun]);
      return generated;
    }), { status: 403 });
    await api.db.query('update public.deals set owner_id=$2 where id=$1', [DEALS.maya, STAFF.dana]);
    await assert.rejects(createDraft(api.db, staff, DEALS.maya, { requestId: randomUUID(), channel: 'sms' }, async () => {
      await api.db.query('update public.buyers set opted_out=true where id=(select buyer_id from public.deals where id=$1)', [DEALS.maya]);
      return generated;
    }), { status: 409 });
    assert.equal((await api.db.query('select id from public.reply_drafts')).length, 0);
  });

  it('keeps one draft for concurrent retries', async () => {
    const id = randomUUID();
    const results = await Promise.all([create(id), create(id)]);
    assert.ok(results.every(result => result.status === 200));
    assert.equal((await api.db.query('select id from public.reply_drafts')).length, 1);
  });
});

describe('AI provider errors over HTTP', () => {
  const api = useApi({ replyGenerator: groqReplyGenerator() });
  it('returns a useful configuration error and writes no draft or timeline event', async () => {
    const before = await api.db.query('select id from public.timeline_events');
    const response = await api.call(STAFF.dana, 'POST', `/api/deals/${DEALS.maya}/reply-drafts`, { requestId: randomUUID(), channel: 'sms' });
    assert.equal(response.status, 503);
    assert.match(response.body.error, /GROQ_API_KEY/);
    assert.equal((await api.db.query('select id from public.reply_drafts')).length, 0);
    assert.deepEqual(await api.db.query('select id from public.timeline_events'), before);
  });
});
