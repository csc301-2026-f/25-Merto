// Persistent integration check. Requires DATABASE_URL; never falls back to a sandbox.
// Keeps one fictional fixture so its saved review can be inspected and reruns are safe.
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { postgresDatabase, type Database } from '../src/db.ts';
import { STAFF } from '../src/seed-ids.ts';

try { process.loadEnvFile(); } catch { /* Environment variables also work. */ }
const url = process.env.DATABASE_URL;
if (!url || url.includes('[YOUR-PASSWORD]')) {
  throw new Error('Set DATABASE_URL in backend/.env before running check:hosted.');
}
const fixture = {
  buyer: '29000000-0000-0000-0000-000000000001',
  deal: '39000000-0000-0000-0000-000000000001',
  event: '49000000-0000-0000-0000-000000000001',
};
const note = 'Hosted integration check: fictional visit was not confirmed by staff.';
let db: Database = postgresDatabase(url);
let server: Server | undefined;
let baseUrl = '';

async function start() {
  server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server!.once('listening', resolve);
    server!.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function stop() {
  if (server) {
    const closing = new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closing;
    server = undefined;
  }
  await db.close();
}

async function call(method: string, path: string, body?: object) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { 'X-Staff-Id': STAFF.karen, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, `${method} ${path} failed (HTTP ${response.status})`);
  return response.json();
}

async function storedState() {
  return {
    evaluations: await db.query('select * from public.ai_evaluations where deal_id = $1 order by id', [fixture.deal]),
    flags: await db.query('select * from public.ai_flags where deal_id = $1 order by id', [fixture.deal]),
    history: await db.query("select * from public.timeline_events where deal_id = $1 and event_type in ('ai_evaluation', 'ai_review') order by id", [fixture.deal]),
  };
}

try {
  // Check schema and known employee before creating any fixture records.
  await db.query('select id from public.ai_evaluations limit 0');
  await db.query('select evidence_event_id, reviewed_at from public.ai_flags limit 0');
  assert.equal((await db.query('select id from public.staff_users where id = $1 and role = $2', [STAFF.karen, 'gm'])).length, 1);
  await db.transaction(async tx => {
    await tx.query(`insert into public.buyers (id, name, email)
      values ($1, 'Integration Check Buyer', 'integration-check@example.com') on conflict (id) do nothing`, [fixture.buyer]);
    await tx.query(`insert into public.deals (id, buyer_id, owner_id, vehicle_interest, source)
      values ($1, $2, $3, 'Fictional integration vehicle', 'integration_check') on conflict (id) do nothing`,
      [fixture.deal, fixture.buyer, STAFF.dana]);
    await tx.query(`insert into public.timeline_events (id, deal_id, actor_type, channel, direction, body)
      values ($1, $2, 'ai', 'email', 'outbound', '[Simulated integration check] You''re all set for tomorrow. See you then.')
      on conflict (id) do nothing`, [fixture.event, fixture.deal]);
  });
  await start();
  const evaluated = await call('POST', `/api/deals/${fixture.deal}/evaluation`);
  assert.equal(evaluated.result, 'flagged');
  const details = await call('GET', `/api/deals/${fixture.deal}/evaluation`);
  const flag = details.flags.find((item: { flagType: string }) => item.flagType === 'appointment_certainty');
  assert.ok(flag, 'The unconfirmed visit must be flagged');
  if (flag.reviewStatus === 'pending') {
    await call('POST', `/api/ai-flags/${flag.id}/review`, { decision: 'confirmed_issue', note });
  } else {
    assert.equal(flag.reviewStatus, 'confirmed_issue', 'Existing fixture was changed; inspect it rather than overwrite a review');
  }
  const before = await storedState();
  assert.equal(before.evaluations.length, 1);
  assert.equal(before.flags.length, 1);
  assert.equal(before.history.length, 2);
  assert.equal((before.flags[0] as { review_note: string }).review_note, note);
  console.log('PASS: HTTP evaluation, flag review, and timeline writes persisted to PostgreSQL.');

  // Destroy the backend HTTP server and its connection pool, then start fresh.
  await stop();
  db = postgresDatabase(url);
  await start();
  assert.deepEqual(await storedState(), before);
  const reloaded = await call('GET', `/api/deals/${fixture.deal}/evaluation`);
  assert.equal(reloaded.status, 'confirmed_issue');
  assert.equal(reloaded.flags[0].id, flag.id);
  assert.equal(reloaded.flags[0].reviewNote, note);
  console.log('PASS: Saved evaluation, review, and history survived backend server/connection restart.');

  const rerun = await call('POST', `/api/deals/${fixture.deal}/evaluation`);
  assert.equal(rerun.newFlags, 0);
  const after = await storedState();
  assert.deepEqual(after.flags, before.flags);
  assert.deepEqual(after.history, before.history);
  console.log('PASS: Re-evaluation did not duplicate flags/history or overwrite the manager review.');
  await db.transaction(async tx => {
    const invalidWrites = [
      { sql: `insert into public.ai_flags (deal_id, evidence_event_id, flag_type, severity, explanation)
          select deal_id, evidence_event_id, flag_type, severity, explanation from public.ai_flags where id = $1`,
        params: [flag.id], code: '23505' },
      { sql: "update public.ai_flags set review_status = 'pending' where id = $1",
        params: [flag.id], code: '23514' },
      { sql: `insert into public.ai_flags (deal_id, evidence_event_id, flag_type, severity, explanation)
          values ($1, '40000000-0000-0000-0000-000000000002', 'tone', 'low', 'Wrong deal evidence')`,
        params: [fixture.deal], code: '23503' },
    ];
    for (const write of invalidWrites) {
      await tx.query('savepoint invalid_record');
      await assert.rejects(tx.query(write.sql, write.params), (error: unknown) => {
        assert.equal((error as { code: string }).code, write.code);
        return true;
      });
      await tx.query('rollback to savepoint invalid_record');
      await tx.query('release savepoint invalid_record');
    }
  });
  assert.deepEqual((await storedState()).flags, before.flags);
  console.log('PASS: Hosted constraints rejected duplicate flags, inconsistent review metadata, and evidence from another deal.');
  console.log(`Retained fictional fixture deal: ${fixture.deal}`);
} catch (error) {
  // Do not print connection strings or driver diagnostics that might contain credentials.
  console.error('Hosted integration check failed. Check database reachability, migrations, and the fixture state.');
  if (error instanceof Error) console.error('Failure code:', (error as Error & { code?: string }).code ?? error.name);
  if (error instanceof assert.AssertionError) console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop();
}
