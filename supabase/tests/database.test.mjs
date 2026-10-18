import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const supabaseRoot = new URL('../', import.meta.url);
const readSql = (path) => readFile(new URL(path, supabaseRoot), 'utf8');
const migrationNames = (await readdir(new URL('migrations/', supabaseRoot)))
  .filter((name) => name.endsWith('.sql')).sort();
const migrations = await Promise.all(migrationNames.map((name) => readSql(`migrations/${name}`)));
// Only the base seed: these counts describe it. The backend tests load every seed file.
const seed = await readSql('seed/seed.sql');
const seedNames = (await readdir(new URL('seed/', supabaseRoot)))
  .filter((name) => name.endsWith('.sql')).sort();
const allSeeds = await Promise.all(seedNames.map((name) => readSql(`seed/${name}`)));
const demos = await readSql('demo/queries.sql');
const transfer = await readSql('demo/transfer.sql');
const tables = ['staff_users', 'buyers', 'deals', 'timeline_events', 'appointments', 'open_items',
  'ai_evaluations', 'ai_flags', 'deal_assignments'];
const ids = {
  karen: '10000000-0000-0000-0000-000000000001',
  dana: '10000000-0000-0000-0000-000000000002',
  arjun: '10000000-0000-0000-0000-000000000003',
  jordanBuyer: '20000000-0000-0000-0000-000000000001',
  jordan: '30000000-0000-0000-0000-000000000001',
  hannah: '30000000-0000-0000-0000-000000000002',
  rob: '30000000-0000-0000-0000-000000000004',
  jordanAssigned: '40000000-0000-0000-0000-000000000003',
  hannahTransferred: '40000000-0000-0000-0000-000000000007',
  missing: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
};

describe('Merto database contract', () => {
  let db;

  beforeEach(async () => {
    db = new PGlite();
    // Reproduce the two Supabase API roles; no cloud credentials are used.
    await db.exec('create role anon; create role authenticated;');
    for (const migration of migrations) await db.exec(migration);
    await db.exec(seed);
  });

  afterEach(async () => { if (db) await db.close(); });

  async function snapshot() {
    const result = {};
    for (const table of tables) {
      // Identifiers come only from the fixed table list above.
      result[table] = (await db.query(`select * from public.${table} order by id`)).rows;
    }
    return result;
  }

  async function expectSqlError(sql, params, code) {
    await assert.rejects(db.query(sql, params), (error) => {
      assert.equal(error.code, code, error.message);
      return true;
    });
  }

  it('loads the real migration and reseeds without duplicating or changing sample records', async () => {
    const before = await snapshot();
    assert.deepEqual(tables.map((table) => before[table].length), [3, 4, 4, 10, 2, 4, 0, 0, 0]);
    await db.exec(seed);
    assert.deepEqual(await snapshot(), before);
  });

  it('runs all six real demo queries and returns the expected business records', async () => {
    const results = await db.exec(demos);
    assert.deepEqual(results.map((result) => result.rows.length), [4, 2, 3, 3, 2, 0]);
    assert.deepEqual(results[1].rows.map((row) => row.buyer), ['Hannah Clarke', 'Jordan Lee']);
    assert.equal(results[0].rows.find((row) => row.buyer === 'Nina Shah').owner, 'Unassigned');
    assert.deepEqual(results[2].rows.map((row) => row.actor_type), ['buyer', 'rep', 'gm']);
    assert.equal(results[2].rows[1].staff_actor, 'Arjun Mehta');
    assert.match(results[2].rows[2].body, /Transferred Hannah from Arjun to Dana/);
    assert.equal(results[3].rows.filter((row) => row.overdue).length, 2);
    assert.deepEqual(results[4].rows.map((row) => row.status), ['confirmed', 'requested']);
  });

  it('removes delivered and lost deals from rep work and pending task queries', async () => {
    await db.query('update public.deals set stage = $1 where id = $2', ['delivered', ids.jordan]);
    await db.query('update public.deals set stage = $1, lost_reason = $2 where id = $3',
      ['lost', 'bought elsewhere', ids.hannah]);
    const results = await db.exec(demos);
    assert.equal(results[1].rows.length, 0);
    assert.deepEqual(results[3].rows.map((row) => row.buyer), ['Nina Shah']);
    assert.equal(results[0].rows.length, 4, 'Closed deals remain in the overview');
  });

  it('transfers ownership and open tasks while preserving history, then rolls back completely', async () => {
    const before = await snapshot();
    // Observe the actual transfer's task update before its rollback.
    const inspectedTransfer = transfer.replace(/rollback;\s*$/i,
      `select owner_id from public.open_items where deal_id = '${ids.hannah}' and status = 'open';\nrollback;`);
    assert.notEqual(inspectedTransfer, transfer, 'The demo must include its final rollback');
    const results = await db.exec(inspectedTransfer);
    const history = results.find((result) => result.rows[0]?.current_owner);
    assert.equal(history.rows.length, 4);
    assert.ok(history.rows.every((row) => row.current_owner === 'Arjun Mehta'));
    assert.deepEqual(history.rows.slice(0, 3).map((row) => row.body),
      before.timeline_events.filter((row) => row.deal_id === ids.hannah)
        .sort((a, b) => a.created_at - b.created_at).map((row) => row.body));
    const taskOwners = results.find((result) => result.rows[0]?.owner_id);
    assert.deepEqual(taskOwners.rows, [{ owner_id: ids.arjun }]);
    assert.deepEqual(await snapshot(), before, 'No demo changes persist after rollback');
  });

  it('rolls back an ownership change when a later write in the transaction fails', async () => {
    const before = await snapshot();
    await db.exec('begin;');
    try {
      await db.query('update public.deals set owner_id = $1 where id = $2', [ids.arjun, ids.hannah]);
      await expectSqlError('insert into public.open_items (deal_id, type, description) values ($1, $2, $3)',
        [ids.missing, 'callback', 'This deal does not exist'], '23503');
    } finally {
      await db.exec('rollback;');
    }
    assert.deepEqual(await snapshot(), before);
  });

  it('rejects references to missing buyers, staff, and deals', async () => {
    await expectSqlError('insert into public.deals (buyer_id, vehicle_interest, source) values ($1, $2, $3)',
      [ids.missing, 'RAV4', 'web'], '23503');
    await expectSqlError('update public.deals set owner_id = $1 where id = $2', [ids.missing, ids.jordan], '23503');
    await expectSqlError("insert into public.timeline_events (deal_id, actor_type, channel, direction, body) values ($1, 'ai', 'email', 'outbound', 'Example')",
      [ids.missing], '23503');
  });

  it('rejects unknown stages and lost deals without a meaningful reason', async () => {
    await expectSqlError('update public.deals set stage = $1 where id = $2', ['unknown', ids.jordan], '23514');
    for (const reason of [null, '', '   ']) {
      await expectSqlError("update public.deals set stage = 'lost', lost_reason = $1 where id = $2",
        [reason, ids.jordan], '23514');
    }
  });

  it('requires staff attribution for human events and rejects it for AI events', async () => {
    await expectSqlError("insert into public.timeline_events (deal_id, actor_type, channel, direction, body) values ($1, 'rep', 'note', 'internal', 'Example')",
      [ids.jordan], '23514');
    await expectSqlError("insert into public.timeline_events (deal_id, actor_type, actor_id, channel, direction, body) values ($1, 'ai', $2, 'email', 'outbound', 'Example')",
      [ids.jordan, ids.dana], '23514');
  });

  it('requires confirmation metadata for confirmed, completed, and no-show appointments', async () => {
    for (const status of ['confirmed', 'completed', 'no_show']) {
      await expectSqlError('insert into public.appointments (deal_id, scheduled_for, status) values ($1, now(), $2)',
        [ids.jordan, status], '23514');
    }
    await expectSqlError("insert into public.appointments (deal_id, scheduled_for, status, confirmed_by) values ($1, now(), 'confirmed', $2)",
      [ids.jordan, ids.dana], '23514');
    await db.query("insert into public.appointments (deal_id, scheduled_for, status, confirmed_by, confirmed_at) values ($1, now(), 'completed', $2, now())",
      [ids.jordan, ids.dana]);
  });

  it('requires a resolution timestamp only for resolved tasks', async () => {
    await expectSqlError("insert into public.open_items (deal_id, type, description, status) values ($1, 'callback', 'Call buyer', 'resolved')",
      [ids.jordan], '23514');
    await expectSqlError("insert into public.open_items (deal_id, type, description, resolved_at) values ($1, 'callback', 'Call buyer', now())",
      [ids.jordan], '23514');
    await db.query("insert into public.open_items (deal_id, type, description, status, resolved_at) values ($1, 'callback', 'Call buyer', 'resolved', now())",
      [ids.jordan]);
  });

  it('detects outbound contact after opt-out, including on another deal for the same buyer', async () => {
    const optedOutBuyer = (await db.query('select buyer_id from public.deals where id = $1', [ids.rob])).rows[0].buyer_id;
    const otherDeal = (await db.query("insert into public.deals (buyer_id, vehicle_interest, source) values ($1, 'Another vehicle', 'email') returning id",
      [optedOutBuyer])).rows[0].id;
    await db.query("insert into public.timeline_events (deal_id, actor_type, channel, direction, body, created_at) values ($1, 'ai', 'email', 'outbound', 'Before opt-out', now() - interval '3 days')",
      [otherDeal]);
    assert.equal((await db.exec(demos))[5].rows.length, 0);
    await db.query("insert into public.timeline_events (deal_id, actor_type, channel, direction, body) values ($1, 'ai', 'email', 'outbound', 'Forbidden after opt-out')",
      [otherDeal]);
    const violations = (await db.exec(demos))[5].rows;
    assert.equal(violations.length, 1);
    assert.equal(violations[0].buyer, 'Rob Lindqvist');
    assert.equal(violations[0].body, 'Forbidden after opt-out');
  });

  it('loads every scenario seed twice without changing records or timestamps', async () => {
    for (const sql of allSeeds) await db.exec(sql);
    const before = await snapshot();
    assert.deepEqual(tables.map((table) => before[table].length), [5, 36, 37, 219, 20, 16, 0, 0, 1]);
    for (const sql of allSeeds) await db.exec(sql);
    assert.deepEqual(await snapshot(), before);
    assert.equal((await db.exec(demos))[0].rows.length, 37);
  });

  // An insert for Hannah's seeded transfer event; overrides change one column at a time.
  function assignmentRecord(overrides = {}) {
    const row = {
      deal_id: ids.hannah, kind: 'transfer', from_owner_id: ids.arjun, to_owner_id: ids.dana,
      assigned_by: ids.karen, reason: 'Arjun is away', timeline_event_id: ids.hannahTransferred,
      ...overrides,
    };
    // Column names come only from the fixed keys above.
    const columns = Object.keys(row);
    return [`insert into public.deal_assignments (${columns.join(', ')})
      values (${columns.map((_, index) => `$${index + 1}`).join(', ')})`, Object.values(row)];
  }

  it('stores who transferred a deal, from whom, to whom, and why', async () => {
    await db.query(...assignmentRecord());
    const rows = (await db.query(`select deal_id, kind, from_owner_id, to_owner_id, assigned_by,
      reason, open_items_moved from public.deal_assignments`)).rows;
    assert.deepEqual(rows, [{
      deal_id: ids.hannah, kind: 'transfer', from_owner_id: ids.arjun, to_owner_id: ids.dana,
      assigned_by: ids.karen, reason: 'Arjun is away', open_items_moved: 0,
    }]);
  });

  it('requires a previous owner exactly for transfers, a different new owner, and a reason', async () => {
    await expectSqlError(...assignmentRecord({ from_owner_id: null }), '23514');
    await expectSqlError(...assignmentRecord({ kind: 'assignment' }), '23514');
    await expectSqlError(...assignmentRecord({ to_owner_id: ids.arjun }), '23514');
    await expectSqlError(...assignmentRecord({ kind: 'unknown' }), '23514');
    await expectSqlError(...assignmentRecord({ open_items_moved: -1 }), '23514');
    for (const reason of ['', '   ']) await expectSqlError(...assignmentRecord({ reason }), '23514');
    await expectSqlError(...assignmentRecord({ reason: null }), '23502');
    assert.equal((await db.query('select * from public.deal_assignments')).rows.length, 0);
    await db.query(...assignmentRecord({
      deal_id: ids.jordan, kind: 'assignment', from_owner_id: null, timeline_event_id: ids.jordanAssigned,
    }));
  });

  it('links each record to exactly one timeline event on the same deal', async () => {
    // Hannah's transfer event exists, but it is not on Jordan's deal.
    await expectSqlError(...assignmentRecord({ deal_id: ids.jordan }), '23503');
    await expectSqlError(...assignmentRecord({ timeline_event_id: ids.missing }), '23503');
    await expectSqlError(...assignmentRecord({ assigned_by: ids.missing }), '23503');
    await db.query(...assignmentRecord());
    await expectSqlError(...assignmentRecord(), '23505');
  });

  async function addFlag() {
    await db.query("insert into public.ai_evaluations (deal_id, result) values ($1, 'flagged')", [ids.jordan]);
    return (await db.query(`insert into public.ai_flags
      (deal_id, evidence_event_id, flag_type, severity, explanation)
      values ($1, '40000000-0000-0000-0000-000000000002', 'tone', 'low', 'Test evidence')
      returning id`, [ids.jordan])).rows[0].id;
  }

  it('inserts an evaluation and its evidence flag successfully', async () => {
    const flagId = await addFlag();
    const evaluations = (await db.query('select deal_id, result from public.ai_evaluations')).rows;
    assert.deepEqual(evaluations, [{ deal_id: ids.jordan, result: 'flagged' }]);
    const flags = (await db.query(`select id, deal_id, evidence_event_id, flag_type,
      severity, explanation, review_status, reviewed_by, reviewed_at from public.ai_flags`)).rows;
    assert.deepEqual(flags, [{
      id: flagId, deal_id: ids.jordan,
      evidence_event_id: '40000000-0000-0000-0000-000000000002',
      flag_type: 'tone', severity: 'low', explanation: 'Test evidence',
      review_status: 'pending', reviewed_by: null, reviewed_at: null,
    }]);
  });

  it('rejects a second evaluation for the same deal with a unique violation', async () => {
    await addFlag();
    const before = await snapshot();
    await expectSqlError("insert into public.ai_evaluations (deal_id, result) values ($1, 'passed')",
      [ids.jordan], '23505');
    assert.deepEqual(await snapshot(), before);
  });

  it('rejects a duplicate flag type for the same evidence message with a unique violation', async () => {
    await addFlag();
    const before = await snapshot();
    await expectSqlError(`insert into public.ai_flags
      (deal_id, evidence_event_id, flag_type, severity, explanation)
      values ($1, '40000000-0000-0000-0000-000000000002', 'tone', 'low', 'Duplicate')`,
      [ids.jordan], '23505');
    assert.deepEqual(await snapshot(), before);
  });

  it('allows different flag types for the same evidence message', async () => {
    await addFlag();
    await db.query(`insert into public.ai_flags
      (deal_id, evidence_event_id, flag_type, severity, explanation)
      values ($1, '40000000-0000-0000-0000-000000000002', 'unsupported_price', 'high', 'Different issue')`,
      [ids.jordan]);
    assert.equal((await db.query('select * from public.ai_flags')).rows.length, 2);
  });

  it('rejects a flag without an evaluation record', async () => {
    await expectSqlError(`insert into public.ai_flags
      (deal_id, evidence_event_id, flag_type, severity, explanation)
      values ($1, '40000000-0000-0000-0000-000000000002', 'tone', 'low', 'No evaluation')`,
      [ids.jordan], '23503');
    assert.equal((await db.query('select * from public.ai_flags')).rows.length, 0);
  });

  it('rejects evidence from another existing deal with a foreign key violation', async () => {
    await db.query("insert into public.ai_evaluations (deal_id, result) values ($1, 'flagged')", [ids.hannah]);
    // Both the evaluation and message exist; only their deal IDs disagree.
    const evidence = (await db.query('select deal_id from public.timeline_events where id = $1',
      ['40000000-0000-0000-0000-000000000002'])).rows;
    assert.deepEqual(evidence, [{ deal_id: ids.jordan }]);
    const before = await snapshot();
    await expectSqlError(`insert into public.ai_flags
      (deal_id, evidence_event_id, flag_type, severity, explanation)
      values ($1, '40000000-0000-0000-0000-000000000002', 'tone', 'low', 'Wrong deal')`,
      [ids.hannah], '23503');
    assert.deepEqual(await snapshot(), before);
  });

  it('rejects inserting a pending flag with a reviewer, even with a review timestamp', async () => {
    await db.query("insert into public.ai_evaluations (deal_id, result) values ($1, 'flagged')", [ids.jordan]);
    const before = await snapshot();
    for (const reviewedAt of [null, '2026-10-13T12:00:00Z']) {
      await expectSqlError(`insert into public.ai_flags
        (deal_id, evidence_event_id, flag_type, severity, explanation,
         review_status, reviewed_by, reviewed_at)
        values ($1, '40000000-0000-0000-0000-000000000002', 'tone', 'low',
          'Test evidence', 'pending', $2, $3)`,
        [ids.jordan, ids.dana, reviewedAt], '23514');
    }
    assert.deepEqual(await snapshot(), before);
  });

  it('requires reviewer and timestamp together for every reviewed flag', async () => {
    const flagId = await addFlag();
    for (const status of ['confirmed_issue', 'false_positive', 'resolved']) {
      for (const [reviewer, reviewedAt] of [
        [null, null], [ids.dana, null], [null, '2026-10-13T12:00:00Z'],
      ]) {
        await expectSqlError(`update public.ai_flags
          set review_status = $1, reviewed_by = $2, reviewed_at = $3 where id = $4`,
          [status, reviewer, reviewedAt, flagId], '23514');
      }
    }
    await expectSqlError('update public.ai_flags set reviewed_at = now() where id = $1', [flagId], '23514');
    await expectSqlError("update public.ai_flags set review_status = 'confirmed_issue', reviewed_by = $1 where id = $2",
      [ids.dana, flagId], '23514');
    await expectSqlError("update public.ai_flags set review_status = 'confirmed_issue', reviewed_by = $1, reviewed_at = now() where id = $2",
      [ids.missing, flagId], '23503');
    await db.query("update public.ai_flags set review_status = 'confirmed_issue', reviewed_by = $1, reviewed_at = now() where id = $2",
      [ids.dana, flagId]);
    await expectSqlError("update public.ai_flags set review_status = 'pending' where id = $1", [flagId], '23514');
    // The database checks metadata; GM-only permission is enforced by the backend.
    const [row] = (await db.query('select review_status, reviewed_by, reviewed_at from public.ai_flags where id = $1', [flagId])).rows;
    assert.equal(row.review_status, 'confirmed_issue');
    assert.equal(row.reviewed_by, ids.dana);
    assert.ok(row.reviewed_at instanceof Date);
  });

  it('rejects invalid evaluation results, flag states and blank explanations', async () => {
    const flagId = await addFlag();
    await expectSqlError("update public.ai_evaluations set result = 'unknown' where deal_id = $1", [ids.jordan], '23514');
    for (const column of ['flag_type', 'severity', 'review_status']) {
      await expectSqlError(`update public.ai_flags set ${column} = 'unknown' where id = $1`, [flagId], '23514');
    }
    for (const explanation of ['', '   ']) {
      await expectSqlError('update public.ai_flags set explanation = $1 where id = $2', [explanation, flagId], '23514');
    }
  });

  it('rolls back an evaluation when storing its evidence flag fails', async () => {
    const before = await snapshot();
    await db.exec('begin;');
    try {
      await db.query("insert into public.ai_evaluations (deal_id, result) values ($1, 'flagged')", [ids.hannah]);
      await expectSqlError(`insert into public.ai_flags
        (deal_id, evidence_event_id, flag_type, severity, explanation)
        values ($1, '40000000-0000-0000-0000-000000000002', 'tone', 'low', 'Wrong deal')`,
        [ids.hannah], '23503');
    } finally {
      await db.exec('rollback;');
    }
    assert.deepEqual(await snapshot(), before);
  });

  it('denies both Supabase API roles access to every demo table', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role};`);
      try {
        for (const table of tables) await expectSqlError(`select * from public.${table}`, [], '42501');
      } finally {
        await db.exec('reset role;');
      }
    }
  });

  it('keeps row-level security enabled and hides rows even if SELECT is later granted', async () => {
    const enabled = (await db.query("select relname from pg_class join pg_namespace n on n.oid = relnamespace where n.nspname = 'public' and relrowsecurity order by relname")).rows;
    assert.deepEqual(enabled.map((row) => row.relname), [...tables].sort());
    await db.exec(`grant usage on schema public to anon, authenticated;
      grant select on ${tables.map((table) => `public.${table}`).join(', ')} to anon, authenticated;`);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role};`);
      try {
        for (const table of tables) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
      } finally {
        await db.exec('reset role;');
      }
    }
  });
});
