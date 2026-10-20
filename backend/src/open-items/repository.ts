// All SQL for unresolved work (US4): the overview, and closing an item.
// Every value is a bound parameter.
import type { Queryable } from '../db.ts';
import type { OpenItemFilters } from './policy.ts';

export interface OpenItemRow {
  id: string;
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  dealStage: string;
  dealOwnerId: string | null;
  dealOwner: string | null;
  type: string;
  description: string;
  status: 'open' | 'resolved' | 'cancelled';
  ownerId: string | null;
  owner: string | null;
  dueAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
  overdue: boolean;
  ageHours: number | null; // only for open items
}

export interface TypeSummary {
  type: string;
  open: number;
  overdue: number;
  unowned: number;
  oldestCreatedAt: Date;
}

// Shared conditions. $1: a rep's ID, or null for the whole store. $2: item type or
// null. $3: item owner's ID, 'none' for items nobody owns, or null. Work on
// delivered or lost deals is closed, so it is never listed here.
const inScope = `
  d.stage not in ('delivered', 'lost')
  and ($1::uuid is null or d.owner_id = $1)
  and ($2::text is null or i.type = $2)
  and ($3::text is null or ($3 = 'none' and i.owner_id is null) or i.owner_id::text = $3)`;

// Open items come first, oldest first (what has waited longest). Resolved and
// cancelled items follow, most recently closed first.
export function listItems(db: Queryable, repId: string | null, filters: OpenItemFilters): Promise<OpenItemRow[]> {
  return db.query<OpenItemRow>(`
    select i.id, i.deal_id as "dealId", b.name as buyer, d.vehicle_interest as "vehicleInterest",
      d.stage as "dealStage", d.owner_id as "dealOwnerId", dow.name as "dealOwner",
      i.type, i.description, i.status, i.owner_id as "ownerId", s.name as owner,
      i.due_at as "dueAt", i.created_at as "createdAt", i.resolved_at as "resolvedAt",
      (i.status = 'open' and i.due_at is not null and i.due_at < now()) as overdue,
      case when i.status = 'open' then floor(extract(epoch from now() - i.created_at) / 3600)::int end as "ageHours"
    from public.open_items i
    join public.deals d on d.id = i.deal_id
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users s on s.id = i.owner_id
    left join public.staff_users dow on dow.id = d.owner_id
    where ${inScope}
      and ($4::text is null or i.status = $4)
    order by (i.status = 'open') desc,
      case when i.status = 'open' then i.created_at end asc,
      i.resolved_at desc nulls last, i.id`,
  [repId, filters.type, filters.owner, filters.status]);
}

// Counts of unresolved work in the same scope, whatever the status filter says.
export function openSummary(db: Queryable, repId: string | null, filters: OpenItemFilters): Promise<TypeSummary[]> {
  return db.query<TypeSummary>(`
    select i.type,
      count(*)::int as open,
      (count(*) filter (where i.due_at is not null and i.due_at < now()))::int as overdue,
      (count(*) filter (where i.owner_id is null))::int as unowned,
      min(i.created_at) as "oldestCreatedAt"
    from public.open_items i
    join public.deals d on d.id = i.deal_id
    where ${inScope}
      and i.status = 'open'
    group by i.type order by i.type`,
  [repId, filters.type, filters.owner]);
}

export interface LockedItem {
  id: string;
  dealId: string;
  buyer: string;
  dealOwnerId: string | null;
  dealStage: string;
  type: string;
  description: string;
  status: 'open' | 'resolved' | 'cancelled';
}

// Row lock on the item and its deal: closing an item and transferring its deal
// (which moves open items) are serialised, so the permission check stays true.
export async function lockItem(db: Queryable, itemId: string): Promise<LockedItem | undefined> {
  const [item] = await db.query<LockedItem>(`
    select i.id, i.deal_id as "dealId", b.name as buyer, d.owner_id as "dealOwnerId",
      d.stage as "dealStage", i.type, i.description, i.status
    from public.open_items i
    join public.deals d on d.id = i.deal_id
    join public.buyers b on b.id = d.buyer_id
    where i.id = $1
    for update of i, d`, [itemId]);
  return item;
}

// resolved_at is set exactly when resolved (a database check); a cancelled item
// has none, so its time lives on the timeline event.
export async function closeItem(db: Queryable, itemId: string, status: 'resolved' | 'cancelled',
  at: Date): Promise<{ status: string; resolvedAt: Date | null }> {
  const [item] = await db.query<{ status: string; resolvedAt: Date | null }>(`
    update public.open_items
    set status = $2, resolved_at = case when $2 = 'resolved' then $3::timestamptz end
    where id = $1
    returning status, resolved_at as "resolvedAt"`, [itemId, status, at]);
  return item;
}

export async function addItemEvent(db: Queryable, dealId: string, actor: { id: string; role: string },
  body: string): Promise<{ id: string; createdAt: Date }> {
  const [event] = await db.query<{ id: string; createdAt: Date }>(`
    insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
    values ($1, 'open_item', $3, $2, 'note', 'internal', $4)
    returning id, created_at as "createdAt"`,
  [dealId, actor.id, actor.role, body]);
  return event;
}
