// Deal tasks: the rep's own to-do list on each deal. Tasks belong to the deal,
// so whoever owns the deal sees and completes its tasks (they move with a
// transfer). A rep works on their own deals; the GM on every deal. Checked
// here, not in the UI.
import { requireDealAccess, type Staff } from '../auth.ts';
import type { Database } from '../db.ts';
import { conflict, notFound } from '../errors.ts';
import { CLOSED_STAGES } from '../assignment/policy.ts';
import { findDeal } from '../deals/repository.ts';
import { dealershipTimeZone } from '../time-zone.ts';
import { parseCompleted, parseNewTask, parseStatusFilter } from './policy.ts';
import * as repo from './repository.ts';

function present({ createdById, createdBy, completedById, completedBy, ...task }: repo.TaskRow) {
  return {
    ...task,
    createdBy: { id: createdById, name: createdBy },
    completedBy: completedById === null ? null : { id: completedById, name: completedBy },
  };
}

async function accessibleDeal(db: Database, staff: Staff, dealId: string) {
  const deal = await findDeal(db, dealId);
  if (!deal) throw notFound('Deal not found.');
  requireDealAccess(staff, deal.ownerId);
  return deal;
}

export async function tasksForDeal(db: Database, staff: Staff, dealId: string) {
  await accessibleDeal(db, staff, dealId);
  return (await repo.dealTasks(db, dealId)).map(present);
}

export async function createTask(db: Database, staff: Staff, dealId: string, body: Record<string, unknown>) {
  const input = parseNewTask(body);
  const deal = await accessibleDeal(db, staff, dealId);
  if ((CLOSED_STAGES as readonly string[]).includes(deal.stage)) {
    throw conflict(`This deal is ${deal.stage}; add tasks only to deals that are still being worked.`);
  }
  const id = await repo.insertTask(db, dealId, input.title, input.dueAt, staff.id);
  return present((await repo.findTask(db, id))!);
}

// Mark a task done, or reopen it if it was ticked by mistake.
export async function setTaskCompleted(db: Database, staff: Staff, taskId: string, body: Record<string, unknown>) {
  const completed = parseCompleted(body);
  await db.transaction(async (tx) => {
    const task = await repo.lockTask(tx, taskId);
    if (!task) throw notFound('Task not found.');
    requireDealAccess(staff, task.dealOwnerId);
    if ((task.status === 'completed') === completed) {
      throw conflict(`This task is already ${task.status}. Reload the page.`);
    }
    await repo.setCompleted(tx, taskId, completed ? staff.id : null);
  });
  return present((await repo.findTask(db, taskId))!);
}

// The Tasks page and the homepage summary: every task on the deals in scope.
export async function tasksOverview(db: Database, staff: Staff, query: Record<string, unknown>) {
  const status = parseStatusFilter(query);
  const repId = staff.role === 'gm' ? null : staff.id;
  const [rows, summary] = await Promise.all([
    repo.listTasks(db, repId, status), repo.openSummary(db, repId, dealershipTimeZone),
  ]);
  return {
    summary,
    tasks: rows.map(({ buyer, vehicleInterest, dealStage, dealOwnerId, dealOwner, ...task }) => ({
      ...present(task),
      deal: {
        id: task.dealId, buyer, vehicleInterest, stage: dealStage,
        owner: dealOwnerId === null ? null : { id: dealOwnerId, name: dealOwner },
      },
    })),
  };
}
