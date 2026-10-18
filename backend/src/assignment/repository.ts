// All SQL for assignment and transfer. Reads the core tables from the database
// team's contract and writes deals, open_items, timeline_events, and
// deal_assignments (the structured who/when/from/to/why). Every value is a bound parameter.
import type { Queryable } from '../db.ts';

export interface LockedDeal {
  id: string;
  buyer: string;
  ownerId: string | null;
  owner: string | null;
  stage: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'gm' | 'rep';
}

export interface Rep {
  id: string;
  name: string;
  email: string;
  activeDeals: number;
}

export interface UnassignedDeal {
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  createdAt: Date;
}

export type AssignmentKind = 'assignment' | 'transfer';

export interface Person {
  id: string;
  name: string;
}

// One change of owner. `structured` is false for timeline entries written before
// deal_assignments existed: their from/to/reason are only in `body`.
export interface AssignmentRecord {
  eventId: string;
  kind: AssignmentKind;
  at: Date;
  by: Person | null;
  from: Person | null;
  to: Person | null;
  reason: string | null;
  openItemsMoved: number | null;
  body: string;
  structured: boolean;
}

const dealColumns = `d.id, b.name as buyer, d.owner_id as "ownerId", o.name as owner, d.stage
    from public.deals d
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users o on o.id = d.owner_id
    where d.id = $1`;

// Row lock: two GMs acting on the same deal at once are serialised.
export async function lockDeal(db: Queryable, dealId: string): Promise<LockedDeal | undefined> {
  const [deal] = await db.query<LockedDeal>(`select ${dealColumns} for update of d`, [dealId]);
  return deal;
}

export async function findDeal(db: Queryable, dealId: string): Promise<LockedDeal | undefined> {
  const [deal] = await db.query<LockedDeal>(`select ${dealColumns}`, [dealId]);
  return deal;
}

export async function findStaff(db: Queryable, staffId: string): Promise<StaffMember | undefined> {
  const [staff] = await db.query<StaffMember>(
    'select id, name, role from public.staff_users where id = $1', [staffId]);
  return staff;
}

// Reps a deal can go to, with their current open workload so the GM can balance it.
export function reps(db: Queryable): Promise<Rep[]> {
  return db.query<Rep>(`
    select s.id, s.name, s.email,
      count(d.id) filter (where d.stage not in ('delivered', 'lost'))::int as "activeDeals"
    from public.staff_users s
    left join public.deals d on d.owner_id = s.id
    where s.role = 'rep'
    group by s.id
    order by s.name, s.id`);
}

export async function setOwner(db: Queryable, dealId: string, ownerId: string, promoteNew: boolean) {
  await db.query(`
    update public.deals
    set owner_id = $2, stage = case when $3::boolean and stage = 'new' then 'assigned' else stage end
    where id = $1`, [dealId, ownerId, promoteNew]);
}

// Open work follows the deal. Resolved and cancelled items keep their old owner.
export async function moveOpenItems(db: Queryable, dealId: string, ownerId: string): Promise<number> {
  const moved = await db.query<{ id: string }>(`
    update public.open_items set owner_id = $2
    where deal_id = $1 and status = 'open' and owner_id is distinct from $2
    returning id`, [dealId, ownerId]);
  return moved.length;
}

// Written by the GM, or by a rep who added a buyer and took it on themselves.
export async function addAssignmentEvent(db: Queryable, dealId: string, actor: StaffMember,
  kind: AssignmentKind, body: string): Promise<{ id: string; createdAt: Date }> {
  const [event] = await db.query<{ id: string; createdAt: Date }>(`
    insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, $4, $3, $2, 'note', 'internal', $5)
    returning id, created_at as "createdAt"`,
  [dealId, actor.id, actor.role, kind, body]);
  return event;
}

export interface NewAssignment {
  dealId: string;
  kind: AssignmentKind;
  fromOwnerId: string | null;
  toOwnerId: string;
  assignedBy: string;
  reason: string;
  openItemsMoved: number;
  eventId: string;
  at: Date;
}

// Uses the timeline event's time, so the record and the entry always agree.
export async function addAssignmentRecord(db: Queryable, record: NewAssignment) {
  await db.query(`
    insert into public.deal_assignments (deal_id, kind, from_owner_id, to_owner_id,
      assigned_by, reason, open_items_moved, timeline_event_id, created_at)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [record.dealId, record.kind, record.fromOwnerId, record.toOwnerId, record.assignedBy,
    record.reason, record.openItemsMoved, record.eventId, record.at]);
}

interface HistoryRow {
  eventId: string;
  kind: AssignmentKind;
  at: Date;
  byId: string | null;
  byName: string | null;
  fromId: string | null;
  fromName: string | null;
  toId: string | null;
  toName: string | null;
  reason: string | null;
  openItemsMoved: number | null;
  body: string;
  structured: boolean;
}

const person = (id: string | null, name: string | null): Person | null =>
  id === null ? null : { id, name: name ?? '' };

// Every assignment/transfer entry on the deal's timeline, oldest first, with its
// structured record when there is one.
export async function assignmentHistory(db: Queryable, dealId: string): Promise<AssignmentRecord[]> {
  const rows = await db.query<HistoryRow>(`
    select e.id as "eventId", e.event_type as kind, e.created_at as at,
      e.actor_id as "byId", actor.name as "byName",
      a.from_owner_id as "fromId", f.name as "fromName",
      a.to_owner_id as "toId", t.name as "toName",
      a.reason, a.open_items_moved as "openItemsMoved", e.body,
      a.id is not null as structured
    from public.timeline_events e
    left join public.deal_assignments a on a.timeline_event_id = e.id
    left join public.staff_users actor on actor.id = e.actor_id
    left join public.staff_users f on f.id = a.from_owner_id
    left join public.staff_users t on t.id = a.to_owner_id
    where e.deal_id = $1 and e.event_type in ('assignment', 'transfer')
    order by e.created_at, e.id`, [dealId]);
  return rows.map((row) => ({
    eventId: row.eventId,
    kind: row.kind,
    at: row.at,
    by: person(row.byId, row.byName),
    from: person(row.fromId, row.fromName),
    to: person(row.toId, row.toName),
    reason: row.reason,
    openItemsMoved: row.openItemsMoved,
    body: row.body,
    structured: row.structured,
  }));
}

// Oldest first: the GM exceptions panel leads with the longest-waiting buyer.
export function unassignedDeals(db: Queryable): Promise<UnassignedDeal[]> {
  return db.query<UnassignedDeal>(`
    select d.id as "dealId", b.name as buyer, d.vehicle_interest as "vehicleInterest",
      d.stage, d.source, d.created_at as "createdAt"
    from public.deals d join public.buyers b on b.id = d.buyer_id
    where d.owner_id is null and d.stage not in ('delivered', 'lost')
    order by d.created_at, d.id`);
}
