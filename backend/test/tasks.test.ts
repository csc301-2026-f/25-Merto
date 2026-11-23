import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNewTask, parseStatusFilter } from '../src/tasks/policy.ts';
import { DEALS, STAFF } from '../src/seed-ids.ts';
import { useApi } from './harness.ts';

type Task = {
  id: string; dealId: string; title: string; status: string; dueAt: string | null; overdue: boolean;
  createdBy: { id: string; name: string }; completedBy: { id: string } | null; completedAt: string | null;
  deal?: { id: string; buyer: string; owner: { id: string } | null };
};

const SEEDED = {
  hannahResidual: '80000000-0000-0000-0000-000000000001', // Dana, overdue
  jordanDetail: '80000000-0000-0000-0000-000000000002', // Dana, due tomorrow-ish
  chrisTrucks: '80000000-0000-0000-0000-000000000003', // Arjun, completed
};

describe('task input', () => {
  it('trims the title and accepts an optional zoned due time', () => {
    assert.deepEqual(parseNewTask({ title: '  Call   the bank ' }), { title: 'Call the bank', dueAt: null });
    assert.deepEqual(parseNewTask({ title: 'x', dueAt: '2026-11-20T15:00:00Z' }).dueAt,
      new Date('2026-11-20T15:00:00Z'));
  });

  it('rejects a blank or long title and a due time without a zone', () => {
    assert.throws(() => parseNewTask({}), /title is required/);
    assert.throws(() => parseNewTask({ title: '   ' }), /title is required/);
    assert.throws(() => parseNewTask({ title: 'x'.repeat(201) }), /at most 200/);
    assert.throws(() => parseNewTask({ title: 'x', dueAt: '2026-11-20T15:00' }), /time zone/);
    assert.throws(() => parseNewTask({ title: 'x', dueAt: 'tomorrow' }), /dueAt/);
  });

  it('defaults the list to open tasks and checks the filter', () => {
    assert.equal(parseStatusFilter({}), 'open');
    assert.equal(parseStatusFilter({ status: 'all' }), null);
    assert.throws(() => parseStatusFilter({ status: 'done' }), /status must be one of/);
  });
});

describe('deal tasks', () => {
  const { call } = useApi();
  const dealTasks = (as: string | null, dealId: string) => call(as, 'GET', `/api/deals/${dealId}/tasks`);
  const create = (as: string | null, dealId: string, body: object) => call(as, 'POST', `/api/deals/${dealId}/tasks`, body);
  const complete = (as: string | null, taskId: string, completed: boolean) =>
    call(as, 'PATCH', `/api/tasks/${taskId}`, { completed });
  const overview = (as: string | null, query = '') => call(as, 'GET', `/api/tasks${query}`);

  it('needs a known staff member', async () => {
    assert.equal((await dealTasks(null, DEALS.hannah)).status, 401);
    assert.equal((await overview(null)).status, 401);
  });

  it("lists a deal's tasks for its rep, open first and soonest due first", async () => {
    const created = await create(STAFF.dana, DEALS.hannah, { title: 'Send insurance form', dueAt: '2099-01-01T15:00:00Z' });
    assert.equal(created.status, 201);
    const { status, body } = await dealTasks(STAFF.dana, DEALS.hannah);
    assert.equal(status, 200);
    assert.deepEqual(body.map((task: Task) => task.title),
      ['Ask finance for the CR-V lease residual', 'Send insurance form']);
    assert.equal(body[0].overdue, true);
    assert.equal(body[1].overdue, false);
  });

  it('lets a rep add a task to their own deal and records who added it', async () => {
    const { status, body } = await create(STAFF.dana, DEALS.jordan, { title: ' Call the bank ', dueAt: '2099-01-01T15:00:00.000Z' });
    assert.equal(status, 201);
    assert.equal(body.title, 'Call the bank');
    assert.equal(body.status, 'open');
    assert.equal(body.dealId, DEALS.jordan);
    assert.equal(body.dueAt, '2099-01-01T15:00:00.000Z');
    assert.deepEqual(body.createdBy, { id: STAFF.dana, name: 'Dana Kowalski' });
    assert.equal(body.completedBy, null);
    const titles = (await dealTasks(STAFF.dana, DEALS.jordan)).body.map((task: Task) => task.title);
    assert.ok(titles.includes('Call the bank'));
  });

  it("keeps reps out of other reps' deals, and lets the GM in", async () => {
    assert.equal((await dealTasks(STAFF.arjun, DEALS.hannah)).status, 403);
    assert.equal((await create(STAFF.arjun, DEALS.hannah, { title: 'Sneaky' })).status, 403);
    assert.equal((await complete(STAFF.arjun, SEEDED.hannahResidual, true)).status, 403);
    assert.equal((await dealTasks(STAFF.karen, DEALS.hannah)).status, 200);
    assert.equal((await create(STAFF.karen, DEALS.hannah, { title: 'GM check-in' })).status, 201);
  });

  it('rejects bad input, unknown deals, and closed deals', async () => {
    assert.equal((await create(STAFF.dana, DEALS.hannah, { title: '' })).status, 400);
    assert.equal((await create(STAFF.dana, 'not-a-uuid', { title: 'x' })).status, 400);
    assert.equal((await create(STAFF.dana, 'ffffffff-ffff-ffff-ffff-ffffffffffff', { title: 'x' })).status, 404);
    const lost = await create(STAFF.arjun, DEALS.rob, { title: 'x' }); // Rob's deal is lost
    assert.equal(lost.status, 409);
    assert.match(lost.body.error, /lost/);
  });

  it('marks a task complete, then reopens it', async () => {
    const done = await complete(STAFF.dana, SEEDED.hannahResidual, true);
    assert.equal(done.status, 200);
    assert.equal(done.body.status, 'completed');
    assert.equal(done.body.completedBy.id, STAFF.dana);
    assert.ok(done.body.completedAt);
    assert.equal(done.body.overdue, false);

    assert.equal((await complete(STAFF.dana, SEEDED.hannahResidual, true)).status, 409, 'already completed');

    const reopened = await complete(STAFF.dana, SEEDED.hannahResidual, false);
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.status, 'open');
    assert.equal(reopened.body.completedBy, null);
    assert.equal(reopened.body.completedAt, null);
  });

  it('rejects a bad completion request and an unknown task', async () => {
    assert.equal((await call(STAFF.dana, 'PATCH', `/api/tasks/${SEEDED.hannahResidual}`, { completed: 'yes' })).status, 400);
    assert.equal((await complete(STAFF.dana, 'ffffffff-ffff-ffff-ffff-ffffffffffff', true)).status, 404);
  });

  it("shows a rep their own open tasks with a summary for the homepage", async () => {
    const { status, body } = await overview(STAFF.dana);
    assert.equal(status, 200);
    assert.deepEqual(body.tasks.map((task: Task) => task.id), [SEEDED.hannahResidual, SEEDED.jordanDetail]);
    assert.equal(body.tasks[0].deal.buyer, 'Hannah Clarke');
    assert.equal(body.tasks[0].deal.owner.id, STAFF.dana);
    assert.equal(body.summary.open, 2);
    assert.equal(body.summary.overdue, 1);
    assert.ok(body.summary.dueToday <= 1);

    assert.deepEqual((await overview(STAFF.arjun)).body.tasks, [], 'Arjun has only a completed task');
    const arjunAll = (await overview(STAFF.arjun, '?status=all')).body;
    assert.deepEqual(arjunAll.tasks.map((task: Task) => task.id), [SEEDED.chrisTrucks]);
    assert.equal(arjunAll.summary.open, 0);
  });

  it('shows the GM every task in the store and checks the filter', async () => {
    const all = (await overview(STAFF.karen, '?status=all')).body.tasks.map((task: Task) => task.id).sort();
    assert.deepEqual(all, Object.values(SEEDED).sort());
    const completed = (await overview(STAFF.karen, '?status=completed')).body.tasks;
    assert.deepEqual(completed.map((task: Task) => task.id), [SEEDED.chrisTrucks]);
    assert.equal((await overview(STAFF.karen, '?status=done')).status, 400);
  });

  it('moves tasks with the deal when it is transferred', async () => {
    const transfer = await call(STAFF.karen, 'POST', `/api/deals/${DEALS.hannah}/transfer`,
      { toUserId: STAFF.arjun, reason: 'Dana is on vacation' });
    assert.equal(transfer.status, 200, JSON.stringify(transfer.body));
    const arjun = (await overview(STAFF.arjun)).body.tasks.map((task: Task) => task.id);
    assert.ok(arjun.includes(SEEDED.hannahResidual));
    const dana = (await overview(STAFF.dana)).body.tasks.map((task: Task) => task.id);
    assert.ok(!dana.includes(SEEDED.hannahResidual));
  });
});
