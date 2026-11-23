import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCENARIOS } from '../src/scenarios/catalog.ts';
import { CHECKS } from '../src/scenarios/checks.ts';
import {
  MAX_ATTEMPTS, PROMPT_VERSION, SYSTEM_PROMPT, UnusableAnswerError, buildMessages, createModelAgentRuntime,
  hourlyLimiter, modelAgentFromEnv, parseModelAnswer, runModelAgent, storeUtcOffset,
} from '../src/scenarios/model-agent.ts';
import { openAiCompatibleClient, type ChatMessage, type ModelClient } from '../src/scenarios/model-client.ts';
import { buildContext } from '../src/scenarios/runner.ts';
import { STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

// A model that answers from a script. No test here reaches a real model or the network.
function fakeClient(script: (string | Error)[], model = 'fake-model') {
  const seen: ChatMessage[][] = [];
  const client: ModelClient = {
    model,
    async complete(messages) {
      const next = script[Math.min(seen.length, script.length - 1)];
      seen.push(messages);
      if (next instanceof Error) throw next;
      return { content: next, usage: { promptTokens: 100, completionTokens: 20 } };
    },
  };
  return { client, seen };
}

const answer = (...actions: object[]) => JSON.stringify({ actions });
const goodVisitReply = answer(
  { tool: 'send_reply', channel: 'sms', body: 'Thanks, Maya. A person will confirm your visit shortly.' },
  { tool: 'request_appointment', scheduledFor: '2026-11-02T15:00:00Z' },
);
const bookedReply = answer(
  { tool: 'send_reply', channel: 'sms', body: "You're all set for Monday at 10 am!" },
  { tool: 'request_appointment', scheduledFor: '2026-11-02T15:00:00Z' },
);

describe('model answers', () => {
  it('reads a plain or fenced JSON answer into tool calls', () => {
    const calls = parseModelAnswer(answer({ tool: 'do_nothing', reason: 'Buyer opted out.' }));
    assert.deepEqual(calls, [{ tool: 'do_nothing', reason: 'Buyer opted out.' }]);
    assert.deepEqual(parseModelAnswer('```json\n' + answer({ tool: 'do_nothing', reason: 'x' }) + '\n```'),
      [{ tool: 'do_nothing', reason: 'x' }]);
  });

  it('rejects an answer it cannot run, with a 502 that says why', () => {
    const bad: [string, RegExp][] = [
      ['I would reply politely.', /not valid JSON/],
      ['{"reply": "hi"}', /no "actions" list/],
      ['{"actions": "send"}', /no "actions" list/],
      [answer(), /actions must be a non-empty array/],
      [answer({ tool: 'delete_deal' }), /tool must be one of/],
      [answer({ tool: 'send_reply', channel: 'call', body: 'x' }), /channel must be email or sms/],
      [answer(...Array.from({ length: 11 }, () => ({ tool: 'do_nothing', reason: 'x' }))), /at most 10/],
    ];
    for (const [content, reason] of bad) {
      assert.throws(() => parseModelAnswer(content),
        (error: unknown) => error instanceof UnusableAnswerError && error.status === 502 && reason.test(error.message),
        content.slice(0, 40));
    }
  });
});

describe('store UTC offset', () => {
  it('works out the offset at that moment, including either side of a clock change', () => {
    assert.equal(storeUtcOffset('2026-11-01T20:00:00Z', 'America/Toronto'), '-05:00'); // after daylight time ended
    assert.equal(storeUtcOffset('2026-10-30T20:00:00Z', 'America/Toronto'), '-04:00'); // just before it ended
    assert.equal(storeUtcOffset('2026-07-01T12:00:00Z', 'Europe/Paris'), '+02:00');
    assert.equal(storeUtcOffset('2026-07-01T12:00:00Z', 'Asia/Kolkata'), '+05:30');
    assert.equal(storeUtcOffset('2026-07-01T12:00:00Z', 'UTC'), '+00:00');
  });
});

describe('model prompt', () => {
  const context = buildContext(SCENARIOS[0]);

  it('tells the model to say a person will confirm a visit request, and how to convert a time to UTC', () => {
    assert.equal(PROMPT_VERSION, 'us13-agent-v2');
    assert.match(SYSTEM_PROMPT, /visit request, tell the buyer that a person will confirm the visit/);
    assert.match(SYSTEM_PROMPT, /UTC = local time minus offset/);
    // The worked example must not be the answer to a scenario.
    assert.ok(!SYSTEM_PROMPT.includes('15:00'));
    assert.ok(!SYSTEM_PROMPT.includes('-05:00'));
  });

  it('hands the model the store offset instead of leaving it to work out the clock change', () => {
    const shown = JSON.parse(buildMessages(context)[1].content);
    assert.match(shown.storeUtcOffset, /^[+-]\d\d:\d\d$/);
    assert.equal(shown.storeUtcOffset, storeUtcOffset(context.now));
  });

  it('gives the store rules and the tools, but never a check or an expected result', () => {
    assert.match(SYSTEM_PROMPT, /Never tell a buyer a visit is booked/);
    for (const tool of ['send_reply', 'create_open_item', 'request_appointment', 'do_nothing']) {
      assert.ok(SYSTEM_PROMPT.includes(tool), tool);
    }
    for (const id of [...Object.keys(CHECKS), ...SCENARIOS.map((scenario) => scenario.id), 'expectedFlags']) {
      assert.ok(!SYSTEM_PROMPT.includes(id), `the prompt must not mention ${id}`);
    }
  });

  it('shows the model the situation without the tool list or the scenario name', () => {
    const [system, user] = buildMessages(context);
    assert.equal(system.role, 'system');
    const shown = JSON.parse(user.content);
    assert.equal(shown.event.body, context.event.body);
    assert.equal(shown.mode, context.mode);
    assert.equal(typeof shown.storeTimeZone, 'string');
    assert.equal(shown.tools, undefined);
    assert.equal(shown.scenario, undefined);
    assert.ok(!user.content.includes(SCENARIOS[0].id));
  });
});

describe('OpenAI-compatible client', () => {
  type Call = { url: string; headers: Record<string, string>; body: any };
  function stubFetch(respond: (call: Call) => Response | Error) {
    const calls: Call[] = [];
    const stub = (async (url: string, init: RequestInit) => {
      const call = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      calls.push(call);
      const result = respond(call);
      if (result instanceof Error) throw result;
      return result;
    }) as unknown as typeof fetch;
    return { stub, calls };
  }
  const ok = (content = '{"actions":[]}', finish = 'stop') => new Response(JSON.stringify({
    choices: [{ message: { content }, finish_reason: finish }], usage: { prompt_tokens: 12, completion_tokens: 3 },
  }), { status: 200 });
  const messages: ChatMessage[] = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }];

  it('sends one JSON-mode request and returns the answer and its token use', async () => {
    const { stub, calls } = stubFetch(() => ok('{"actions":[1]}'));
    const client = openAiCompatibleClient({ apiKey: 'sk-test', model: 'small-model', fetch: stub });
    assert.deepEqual(await client.complete(messages), { content: '{"actions":[1]}', usage: { promptTokens: 12, completionTokens: 3 } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(calls[0].headers.authorization, 'Bearer sk-test');
    assert.equal(calls[0].body.model, 'small-model');
    assert.equal(calls[0].body.temperature, 0);
    assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
    assert.equal(calls[0].body.reasoning_effort, undefined);
  });

  it('asks for repeatable answers only when a seed is set', async () => {
    const seeded = stubFetch(() => ok());
    await openAiCompatibleClient({ apiKey: 'x', model: 'm', seed: 7, fetch: seeded.stub }).complete(messages);
    assert.equal(seeded.calls[0].body.seed, 7);
    const plain = stubFetch(() => ok());
    await openAiCompatibleClient({ apiKey: 'x', model: 'm', fetch: plain.stub }).complete(messages);
    assert.equal('seed' in plain.calls[0].body, false);
  });

  it('sends no Authorization header when there is no key (a local server)', async () => {
    const { stub, calls } = stubFetch(() => ok());
    await openAiCompatibleClient({ model: 'llama3.1', baseUrl: 'http://localhost:11434/v1', fetch: stub }).complete(messages);
    assert.equal('authorization' in calls[0].headers, false);
  });

  it('treats gpt-oss as a reasoning model, and lets the settings override the guess', async () => {
    const oss = stubFetch(() => ok());
    await openAiCompatibleClient({ apiKey: 'x', model: 'openai/gpt-oss-20b', fetch: oss.stub }).complete(messages);
    assert.equal(oss.calls[0].body.reasoning_effort, 'low');
    assert.equal(oss.calls[0].body.temperature, undefined);
    const forced = stubFetch(() => ok());
    await openAiCompatibleClient({ apiKey: 'x', model: 'llama3', reasoning: true, fetch: forced.stub }).complete(messages);
    assert.equal(forced.calls[0].body.reasoning_effort, 'low');
    const off = stubFetch(() => ok());
    await openAiCompatibleClient({ apiKey: 'x', model: 'gpt-5-mini', reasoning: false, fetch: off.stub }).complete(messages);
    assert.equal(off.calls[0].body.temperature, 0);
  });

  it('points at another server by base URL, such as a local one', async () => {
    const { stub, calls } = stubFetch(() => ok());
    await openAiCompatibleClient({ apiKey: 'x', model: 'm', baseUrl: 'http://localhost:11434/v1/', fetch: stub }).complete(messages);
    assert.equal(calls[0].url, 'http://localhost:11434/v1/chat/completions');
  });

  it('gives reasoning models a low effort and a bigger budget, and no temperature', async () => {
    for (const model of ['gpt-5-mini', 'o3']) {
      const { stub, calls } = stubFetch(() => ok());
      await openAiCompatibleClient({ apiKey: 'x', model, fetch: stub }).complete(messages);
      assert.equal(calls[0].body.temperature, undefined, model);
      assert.equal(calls[0].body.reasoning_effort, 'low', model);
      assert.ok(calls[0].body.max_completion_tokens >= 4000, model);
    }
  });

  it('turns provider failures into short messages and never leaks the key or the provider body', async () => {
    const cases: [Response | Error, number, RegExp][] = [
      [new Response('bad key sk-secret-123', { status: 401 }), 503, /rejected the configured key/],
      [new Response('forbidden sk-secret-123', { status: 403 }), 503, /rejected the configured key/],
      [new Response('slow down sk-secret-123', { status: 429 }), 429, /usage limit/],
      [new Response('boom sk-secret-123', { status: 500 }), 503, /unavailable/],
      [new Error('connect ECONNREFUSED sk-secret-123'), 503, /could not be reached/],
      [new Response('<html>not json sk-secret-123', { status: 200 }), 502, /unreadable/],
      [ok('{"actions":[]}', 'length'), 502, /did not finish/],
      [ok('   '), 502, /did not finish/],
    ];
    for (const [result, status, message] of cases) {
      const { stub } = stubFetch(() => result);
      await assert.rejects(openAiCompatibleClient({ apiKey: 'sk-secret-123', model: 'm', fetch: stub }).complete(messages),
        (error: any) => error.status === status && message.test(error.message) && !error.message.includes('sk-secret-123'),
        `${status} ${message}`);
    }
  });
});

describe('running the model agent', () => {
  const context = buildContext(SCENARIOS[0]);

  it('retries one unusable answer and adds up the tokens', async () => {
    const { client, seen } = fakeClient(['not json', goodVisitReply]);
    const run = await runModelAgent(client, context);
    assert.equal(seen.length, 2);
    assert.equal(run.calls.length, 2);
    assert.deepEqual(run.usage, { promptTokens: 200, completionTokens: 40 });
    assert.equal(run.promptVersion, PROMPT_VERSION);
    assert.equal(run.model, 'fake-model');
  });

  it('gives up after the attempt limit with the last 502', async () => {
    const { client, seen } = fakeClient(['not json']);
    await assert.rejects(runModelAgent(client, context), (error: any) => error.status === 502);
    assert.equal(seen.length, MAX_ATTEMPTS);
  });

  it('does not retry a provider error', async () => {
    const { client, seen } = fakeClient([Object.assign(new Error('down'), { status: 503 })]);
    await assert.rejects(runModelAgent(client, context), /down/);
    assert.equal(seen.length, 1);
  });
});

describe('live call limits and configuration', () => {
  it('allows only a set number of runs in a rolling hour', () => {
    let now = 1_000_000;
    const take = hourlyLimiter(2, () => now);
    take();
    take();
    assert.throws(take, (error: any) => error.status === 429 && /limited to 2 per hour/.test(error.message));
    now += 3_600_001;
    assert.doesNotThrow(take);
  });

  it('stays off unless it is switched on and has a key and a model', () => {
    assert.equal(modelAgentFromEnv({}), undefined);
    assert.equal(modelAgentFromEnv({ OPENAI_API_KEY: 'k', MODEL_AGENT_MODEL: 'm' }), undefined, 'not switched on');
    assert.equal(modelAgentFromEnv({ SCENARIO_AI_LIVE: 'true', MODEL_AGENT_MODEL: 'm' }), undefined, 'no key');
    assert.equal(modelAgentFromEnv({ SCENARIO_AI_LIVE: 'true', OPENAI_API_KEY: 'k' }), undefined, 'no model');
    assert.equal(modelAgentFromEnv({ SCENARIO_AI_LIVE: 'yes', OPENAI_API_KEY: 'k', MODEL_AGENT_MODEL: 'm' }), undefined, 'only "true" counts');
  });

  it('needs no key for a server on this machine, but still needs one for a remote server', () => {
    const local = { SCENARIO_AI_LIVE: 'true', MODEL_AGENT_MODEL: 'llama3.1' };
    for (const url of ['http://localhost:11434/v1', 'http://127.0.0.1:8080/v1', 'http://[::1]:1234/v1']) {
      assert.equal(modelAgentFromEnv({ ...local, MODEL_AGENT_BASE_URL: url })?.client.model, 'llama3.1', url);
    }
    assert.equal(modelAgentFromEnv({ ...local, MODEL_AGENT_BASE_URL: 'https://api.groq.com/openai/v1' }), undefined);
    assert.equal(modelAgentFromEnv({ ...local, MODEL_AGENT_BASE_URL: 'https://localhost.evil.example/v1' }), undefined);
    assert.equal(modelAgentFromEnv({ ...local }), undefined, 'no base URL means OpenAI, which needs a key');
    assert.equal(modelAgentFromEnv({ SCENARIO_AI_LIVE: 'true', MODEL_AGENT_BASE_URL: 'http://localhost:11434/v1' }), undefined, 'still needs a model');
  });

  it('turns on with a key and model, and reads the hourly limit', () => {
    const on = modelAgentFromEnv({ SCENARIO_AI_LIVE: 'true', OPENAI_API_KEY: 'k', MODEL_AGENT_MODEL: 'm' });
    assert.equal(on?.client.model, 'm');
    assert.equal(on?.maxPerHour, 30);
    assert.equal(modelAgentFromEnv({ SCENARIO_AI_LIVE: 'true', MODEL_AGENT_API_KEY: 'k', MODEL_AGENT_MODEL: 'm', MODEL_AGENT_MAX_PER_HOUR: '5' })?.maxPerHour, 5);
    assert.equal(modelAgentFromEnv({ SCENARIO_AI_LIVE: 'true', OPENAI_API_KEY: 'k', MODEL_AGENT_MODEL: 'm', MODEL_AGENT_MAX_PER_HOUR: 'many' })?.maxPerHour, 30);
  });
});

describe('model agent through the API (US13)', () => {
  let script: (string | Error)[] = [goodVisitReply];
  let fake = fakeClient(script);
  // The client reads the current script, so each test sets what the "model" will say.
  const liveClient: ModelClient = {
    get model() { return fake.client.model; },
    complete: (messages) => fake.client.complete(messages),
  };
  const say = (...next: (string | Error)[]) => { script = next; fake = fakeClient(script); };
  const api = useApi({ modelAgent: createModelAgentRuntime(liveClient, 1000) });
  const { call } = api;
  const run = (as: string | null, id: string, body: object) => call(as, 'POST', `/api/scenarios/${id}/runs`, body);

  async function rowCounts() {
    const counts: Record<string, number> = {};
    for (const table of ['buyers', 'deals', 'timeline_events', 'open_items', 'appointments']) {
      const [row] = await api.db.query<{ count: string }>(`select count(*) from public.${table}`);
      counts[table] = Number(row.count);
    }
    return counts;
  }

  it('lists the model agent as a live agent, next to the built-in ones', async () => {
    say(goodVisitReply);
    const { agents } = (await call(STAFF.karen, 'GET', '/api/scenarios')).body;
    assert.deepEqual(agents.map((agent: { name: string; live: boolean }) => [agent.name, agent.live]),
      [['careful', false], ['eager', false], ['model', true]]);
    const model = agents.find((agent: { name: string }) => agent.name === 'model');
    assert.equal(model.model, 'fake-model');
    assert.match(model.description, /billed/);
  });

  it('is for the General Manager only, and a refused call never reaches the model', async () => {
    say(goodVisitReply);
    assert.equal((await run(STAFF.dana, 'deal-j', { agent: 'model' })).status, 403);
    assert.equal((await run(null, 'deal-j', { agent: 'model' })).status, 401);
    assert.equal(fake.seen.length, 0);
  });

  it('scores what the model chose and says which model, prompt, and tokens it used', async () => {
    say(goodVisitReply);
    const { status, body } = await run(STAFF.karen, 'deal-j', { agent: 'model' });
    assert.equal(status, 200);
    assert.equal(body.agent.name, 'model');
    assert.equal(body.agent.kind, 'model');
    assert.deepEqual(body.agent.model, {
      id: 'fake-model', promptVersion: PROMPT_VERSION, source: 'live', usage: { promptTokens: 100, completionTokens: 20 },
    });
    assert.equal(body.summary.verdict, 'pass');
    assert.deepEqual(body.steps.map((step: { call: { tool: string } }) => step.call.tool), ['send_reply', 'request_appointment']);
    assert.equal(fake.seen.length, 1);
  });

  it('catches the model making the mistake the brief warns about', async () => {
    say(bookedReply);
    const { body } = await run(STAFF.karen, 'deal-j', { agent: 'model' });
    assert.equal(body.summary.verdict, 'fail');
    assert.ok(body.checks.some((check: { id: string; passed: boolean }) => check.id === 'no_booking_claim' && !check.passed));
    assert.deepEqual(body.flags.map((flag: { flagType: string }) => flag.flagType), ['appointment_certainty']);
  });

  it('saves nothing, like every other run', async () => {
    say(goodVisitReply);
    const before = await rowCounts();
    await run(STAFF.karen, 'deal-j', { agent: 'model' });
    assert.deepEqual(await rowCounts(), before);
  });

  it('reports an unusable answer as a 502 after one retry, without a scorecard or any saved data', async () => {
    say('I would reply politely.');
    const before = await rowCounts();
    const { status, body } = await run(STAFF.karen, 'deal-j', { agent: 'model' });
    assert.equal(status, 502);
    assert.match(body.error, /could not be used/);
    assert.equal(fake.seen.length, MAX_ATTEMPTS);
    assert.deepEqual(await rowCounts(), before);
  });

  it('passes a provider error straight through as its own status', async () => {
    say(Object.assign(new Error('The model reached its usage limit. Please try again later.'), { status: 429 }));
    const { status, body } = await run(STAFF.karen, 'deal-j', { agent: 'model' });
    assert.equal(status, 429);
    assert.match(body.error, /usage limit/);
  });

  it('keeps the model out of "run all" unless it is named, since each scenario is a live call', async () => {
    say(answer({ tool: 'do_nothing', reason: 'Nothing to do.' }));
    const plain = await call(STAFF.karen, 'POST', '/api/scenario-runs', { agents: ['careful'] });
    assert.equal(plain.status, 200);
    assert.equal(fake.seen.length, 0);

    const both = await call(STAFF.karen, 'POST', '/api/scenario-runs', { agents: ['careful', 'model'] });
    assert.equal(both.status, 200);
    assert.equal(fake.seen.length, SCENARIOS.length);
    assert.deepEqual(both.body.results.map((result: { agent: string }) => result.agent), ['careful', 'model']);
    assert.equal(both.body.results[1].scorecards.length, SCENARIOS.length);
    assert.equal(both.body.comparison.length, SCENARIOS.length);
  });
});

describe('model agent with a low hourly limit', () => {
  const fake = fakeClient([goodVisitReply]);
  const api = useApi({ modelAgent: createModelAgentRuntime(fake.client, 2) });

  it('refuses the run after the limit with a 429, and the model is not called again', async () => {
    const run = () => api.call(STAFF.karen, 'POST', '/api/scenarios/deal-j/runs', { agent: 'model' });
    assert.equal((await run()).status, 200);
    assert.equal((await run()).status, 200);
    const third = await run();
    assert.equal(third.status, 429);
    assert.match(third.body.error, /limited to 2 per hour/);
    assert.equal(fake.seen.length, 2);
  });
});

describe('model agent when live calls are not configured', () => {
  const api = useApi();

  it('does not offer the model agent and refuses to run it', async () => {
    const { agents } = (await api.call(STAFF.karen, 'GET', '/api/scenarios')).body;
    assert.deepEqual(agents.map((agent: { name: string }) => agent.name), ['careful', 'eager']);
    const run = await api.call(STAFF.karen, 'POST', '/api/scenarios/deal-j/runs', { agent: 'model' });
    assert.equal(run.status, 400);
    assert.match(run.body.error, /agent must be one of: careful, eager/);
    assert.equal((await api.call(STAFF.karen, 'POST', '/api/scenario-runs', { agents: ['model'] })).status, 400);
  });
});
