// Walks through the evaluation API over real HTTP against an in-memory sandbox.
// Usage: npm run demo    (no Supabase account, credentials, or API key needed)
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { sandboxDatabase } from '../src/sandbox-db.ts';
import { DEALS, EVENTS, STAFF } from '../src/seed-ids.ts';

const db = await sandboxDatabase();
const server = createApp(db).listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

async function call(as: string, method: string, path: string, body?: object) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { 'x-staff-id': as, ...(body && { 'content-type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

function show(title: string, { status, json }: { status: number; json: unknown }, columns?: string[]) {
  console.log(`\n${title}\n→ HTTP ${status}`);
  const short = (value: unknown) =>
    typeof value === 'string' && value.length > 60 ? `${value.slice(0, 59)}…` : value;
  const pick = (row: Record<string, unknown>) =>
    Object.fromEntries((columns ?? Object.keys(row)).map((key) => [key, short(row[key])]));
  if (Array.isArray(json)) console.table(json.map(pick));
  else console.dir(json, { depth: 3 });
}

const flagIdFor = async (eventId: string, flagType: string) => {
  const queue = (await call(STAFF.karen, 'GET', '/api/ai-flags/queue')).json;
  return queue.find((flag: { evidenceEventId: string; flagType: string }) =>
    flag.evidenceEventId === eventId && flag.flagType === flagType).id;
};

try {
  show('1. Karen (GM) runs the nightly evaluation',
    await call(STAFF.karen, 'POST', '/api/evaluations/run'), ['buyer', 'result', 'newFlags']);
  show('2. Karen sees every pending flag, worst first',
    await call(STAFF.karen, 'GET', '/api/ai-flags/queue'), ['buyer', 'owner', 'flagType', 'severity', 'evidenceBody']);
  show('3. Dana (rep) sees flags on her own deals only',
    await call(STAFF.dana, 'GET', '/api/ai-flags/queue'), ['buyer', 'flagType', 'evidenceBody']);

  const mayaFlag = await flagIdFor(EVENTS.mayaAllSet, 'appointment_certainty');
  show('4. Dana tries to review a flag: blocked on the server',
    await call(STAFF.dana, 'POST', `/api/ai-flags/${mayaFlag}/review`, { decision: 'false_positive' }));
  show('5. Karen confirms the "You\'re all set" message as a real problem',
    await call(STAFF.karen, 'POST', `/api/ai-flags/${mayaFlag}/review`,
      { decision: 'confirmed_issue', note: 'Maya arrived for a visit nobody had confirmed.' }));

  const toneFlag = await flagIdFor(EVENTS.benDoubleExclamation, 'tone');
  show('6. Karen marks the "!!" tone flag on Ben\'s first text a false positive',
    await call(STAFF.karen, 'POST', `/api/ai-flags/${toneFlag}/review`,
      { decision: 'false_positive', note: 'Friendly, not pushy.' }));

  const maya = await call(STAFF.dana, 'GET', `/api/deals/${DEALS.maya}/evaluation`);
  show('7. Maya\'s buyer record (Dana\'s view): status and evidence', {
    status: maya.status, json: { status: maya.json.status, flags: maya.json.flags.map(
      (flag: Record<string, unknown>) => ({ flagType: flag.flagType, reviewStatus: flag.reviewStatus, evidence: flag.evidenceBody })) },
  });
  show('8. GM metrics (null would read "not measured")',
    await call(STAFF.karen, 'GET', '/api/ai-evaluation/metrics'));

  // There is no messaging API yet, so the AI's message is written directly.
  await db.query(`insert into public.timeline_events (deal_id, actor_type, channel, direction, body)
    values ($1, 'ai', 'email', 'outbound', '[Simulated] Still thinking about the CX-5?')`, [DEALS.rob]);
  show('9. The AI emails Rob after he opted out; re-evaluating his deal',
    await call(STAFF.karen, 'POST', `/api/deals/${DEALS.rob}/evaluation`));
  show('   …and the flag points to that exact message',
    { status: 200, json: (await call(STAFF.karen, 'GET', `/api/deals/${DEALS.rob}/evaluation`)).json.flags },
    ['flagType', 'severity', 'evidenceBody']);
} finally {
  server.closeAllConnections();
  server.close();
  await db.close();
}
