// All SQL for deal tasks. Every value is a bound parameter.
import type { Queryable } from '../db.ts';

export interface TaskRow {
  id: string;
  dealId: string;
  title: string;
  status: 'open' | 'completed';
  dueAt: Date | null;
  overdue: boolean;
  createdAt: Date;
  createdById: string;
  createdBy: string;
  completedAt: Date | null;
  completedById: string | null;
  completedBy: string | null;
}

export interface TaskWithDealRow extends TaskRow {
  buyer: string;
  vehicleInterest: string;
  dealStage: string;
  dealOwnerId: string | null;
  dealOwner: string | null;
}

const taskColumns = `
  t.id, t.deal_id as "dealId", t.title, t.status, t.due_at as "dueAt",
  (t.status = 'open' and t.due_at is not null and t.due_at < now()) as overdue,
  t.created_at as "createdAt", t.created_by as "createdById", cs.name as "createdBy",
  t.completed_at as "completedAt", t.completed_by as "completedById", ds.name as "completedBy"`;

const taskJoins = `
  join public.staff_users cs on cs.id = t.created_by
  left join public.staff_users ds on ds.id = t.completed_by`;

// Open tasks first, soonest due first (undated ones after dated ones, oldest
// first); completed tasks after, most recently completed first.
const taskOrder = `
  order by (t.status = 'open') desc,
    case when t.status = 'open' then t.due_at end asc nulls last,
    case when t.status = 'open' then t.created_at end asc,
    t.completed_at desc nulls last, t.id`;

export function dealTasks(db: Queryable, dealId: string): Promise<TaskRow[]> {
  return db.query<TaskRow>(`
    select ${taskColumns}
    from public.deal_tasks t ${taskJoins}
    where t.deal_id = $1
    ${taskOrder}`, [dealId]);
}

// $1: a rep's ID (tasks on deals they own now), or null for the whole store.
// $2: 'open', 'completed', or null for both.
export function listTasks(db: Queryable, repId: string | null, status: string | null): Promise<TaskWithDealRow[]> {
  return db.query<TaskWithDealRow>(`
    select ${taskColumns}, b.name as buyer, d.vehicle_interest as "vehicleInterest",
      d.stage as "dealStage", d.owner_id as "dealOwnerId", dow.name as "dealOwner"
    from public.deal_tasks t ${taskJoins}
    join public.deals d on d.id = t.deal_id
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users dow on dow.id = d.owner_id
    where ($1::uuid is null or d.owner_id = $1)
      and ($2::text is null or t.status = $2)
    ${taskOrder}`, [repId, status]);
}

// Open-task counts in the same scope, whatever the status filter says.
// dueToday: due between now and the end of today in the dealership's time zone.
export async function openSummary(db: Queryable, repId: string | null, timeZone: string) {
  const [row] = await db.query<{ open: number; overdue: number; dueToday: number }>(`
    select count(*)::int as open,
      (count(*) filter (where t.due_at < now()))::int as overdue,
      (count(*) filter (where t.due_at >= now()
        and t.due_at < (date_trunc('day', now() at time zone $2) + interval '1 day') at time zone $2))::int as "dueToday"
    from public.deal_tasks t
    join public.deals d on d.id = t.deal_id
    where t.status = 'open' and ($1::uuid is null or d.owner_id = $1)`, [repId, timeZone]);
  return row;
}

export async function insertTask(db: Queryable, dealId: string, title: string, dueAt: Date | null,
  createdBy: string): Promise<string> {
  const [row] = await db.query<{ id: string }>(`
    insert into public.deal_tasks (deal_id, title, due_at, created_by)
    values ($1, $2, $3, $4) returning id`, [dealId, title, dueAt, createdBy]);
  return row.id;
}

export async function findTask(db: Queryable, taskId: string): Promise<TaskRow | undefined> {
  const [task] = await db.query<TaskRow>(`
    select ${taskColumns} from public.deal_tasks t ${taskJoins} where t.id = $1`, [taskId]);
  return task;
}

// Row lock on the task and its deal, so a transfer cannot change the owner
// between the permission check and the update.
export async function lockTask(db: Queryable, taskId: string) {
  const [task] = await db.query<{ id: string; status: string; dealOwnerId: string | null }>(`
    select t.id, t.status, d.owner_id as "dealOwnerId"
    from public.deal_tasks t join public.deals d on d.id = t.deal_id
    where t.id = $1
    for update of t, d`, [taskId]);
  return task;
}

export async function setCompleted(db: Queryable, taskId: string, completedBy: string | null): Promise<void> {
  await db.query(`
    update public.deal_tasks
    set status = case when $2::uuid is null then 'open' else 'completed' end,
      completed_by = $2, completed_at = case when $2::uuid is null then null else now() end
    where id = $1`, [taskId, completedBy]);
}
