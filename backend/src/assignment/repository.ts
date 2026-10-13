// All SQL for assignment and transfer. Uses only the core tables from the
// database team's contract; no schema changes. Every value is a bound parameter.
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

export interface UnassignedDeal {
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  createdAt: Date;
}

export interface AssignmentEvent {
  id: string;
  eventType: 'assignment' | 'transfer';
  actorId: string;
  actor?: string;
  body: string;
  createdAt: Date;
}

// Row lock: two GMs acting on the same deal at once are serialised.
export async function lockDeal(db: Queryable, dealId: string): Promise<LockedDeal | undefined> {
  const [deal] = await db.query<LockedDeal>(`
    select d.id, b.name as buyer, d.owner_id as "ownerId", o.name as owner, d.stage
    from public.deals d
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users o on o.id = d.owner_id
    where d.id = $1
    for update of d`, [dealId]);
  return deal;
}

export async function findDeal(db: Queryable, dealId: string): Promise<LockedDeal | undefined> {
  const [deal] = await db.query<LockedDeal>(`
    select d.id, b.name as buyer, d.owner_id as "ownerId", o.name as owner, d.stage
    from public.deals d
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users o on o.id = d.owner_id
    where d.id = $1`, [dealId]);
  return deal;
}

export async function findStaff(db: Queryable, staffId: string): Promise<StaffMember | undefined> {
  const [staff] = await db.query<StaffMember>(
    'select id, name, role from public.staff_users where id = $1', [staffId]);
  return staff;
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

export async function addAssignmentEvent(db: Queryable, dealId: string, gmId: string,
  eventType: 'assignment' | 'transfer', body: string): Promise<AssignmentEvent> {
  const [event] = await db.query<AssignmentEvent>(`
    insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, $3, 'gm', $2, 'note', 'internal', $4)
    returning id, event_type as "eventType", actor_id as "actorId", body, created_at as "createdAt"`,
  [dealId, gmId, eventType, body]);
  return event;
}

export function assignmentHistory(db: Queryable, dealId: string): Promise<AssignmentEvent[]> {
  return db.query<AssignmentEvent>(`
    select e.id, e.event_type as "eventType", e.actor_id as "actorId", s.name as actor,
      e.body, e.created_at as "createdAt"
    from public.timeline_events e
    left join public.staff_users s on s.id = e.actor_id
    where e.deal_id = $1 and e.event_type in ('assignment', 'transfer')
    order by e.created_at, e.id`, [dealId]);
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
