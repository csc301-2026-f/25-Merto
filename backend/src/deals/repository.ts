// SQL for deal lists, the buyer record, and adding a buyer. Every value is a bound parameter.
import type { Queryable } from '../db.ts';
import type { NewDeal } from './policy.ts';

export interface DealListItem {
  dealId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  source: string;
  ownerId: string | null;
  owner: string | null;
  optedOut: boolean;
  openItems: number;
  lastActivityAt: Date | null;
  createdAt: Date;
}

export interface DealRecord {
  dealId: string;
  buyerId: string;
  buyer: string;
  email: string | null;
  phone: string | null;
  preferredChannel: string;
  optedOut: boolean;
  vehicleInterest: string;
  stage: string;
  source: string;
  lostReason: string | null;
  ownerId: string | null;
  owner: string | null;
  createdAt: Date;
}

// actorType says whether the AI, a rep, the GM, the system, or the buyer acted;
// actorName is the staff member's name for rep/GM entries and null otherwise.
export interface TimelineEntry {
  id: string;
  eventType: string;
  actorType: 'buyer' | 'ai' | 'rep' | 'gm' | 'system';
  actorId: string | null;
  actorName: string | null;
  channel: string;
  direction: string;
  body: string;
  createdAt: Date;
}

export interface OpenItem {
  id: string;
  type: string;
  description: string;
  status: string;
  ownerId: string | null;
  owner: string | null;
  dueAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface Appointment {
  id: string;
  scheduledFor: Date;
  status: string;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  outcomeNote: string | null;
}

// Open deals (not delivered or lost), most recent activity first. ownerId null
// lists every deal; otherwise only that rep's.
export function activeDeals(db: Queryable, ownerId: string | null): Promise<DealListItem[]> {
  return db.query<DealListItem>(`
    select d.id as "dealId", b.name as buyer, d.vehicle_interest as "vehicleInterest",
      d.stage, d.source, d.owner_id as "ownerId", o.name as owner, b.opted_out as "optedOut",
      (select count(*)::int from public.open_items i
        where i.deal_id = d.id and i.status = 'open') as "openItems",
      (select max(e.created_at) from public.timeline_events e
        where e.deal_id = d.id) as "lastActivityAt",
      d.created_at as "createdAt"
    from public.deals d
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users o on o.id = d.owner_id
    where d.stage not in ('delivered', 'lost') and ($1::uuid is null or d.owner_id = $1)
    order by "lastActivityAt" desc nulls last, d.id`, [ownerId]);
}

export async function findDeal(db: Queryable, dealId: string): Promise<DealRecord | undefined> {
  const [deal] = await db.query<DealRecord>(`
    select d.id as "dealId", b.id as "buyerId", b.name as buyer, b.email, b.phone,
      b.preferred_channel as "preferredChannel", b.opted_out as "optedOut",
      d.vehicle_interest as "vehicleInterest", d.stage, d.source, d.lost_reason as "lostReason",
      d.owner_id as "ownerId", o.name as owner, d.created_at as "createdAt"
    from public.deals d
    join public.buyers b on b.id = d.buyer_id
    left join public.staff_users o on o.id = d.owner_id
    where d.id = $1`, [dealId]);
  return deal;
}

export function timeline(db: Queryable, dealId: string): Promise<TimelineEntry[]> {
  return db.query<TimelineEntry>(`
    select e.id, e.event_type as "eventType", e.actor_type as "actorType", e.actor_id as "actorId",
      s.name as "actorName", e.channel, e.direction, e.body, e.created_at as "createdAt"
    from public.timeline_events e
    left join public.staff_users s on s.id = e.actor_id
    where e.deal_id = $1
    order by e.created_at, e.id`, [dealId]);
}

export function openItems(db: Queryable, dealId: string): Promise<OpenItem[]> {
  return db.query<OpenItem>(`
    select i.id, i.type, i.description, i.status, i.owner_id as "ownerId", s.name as owner,
      i.due_at as "dueAt", i.created_at as "createdAt", i.resolved_at as "resolvedAt"
    from public.open_items i
    left join public.staff_users s on s.id = i.owner_id
    where i.deal_id = $1
    order by i.status = 'open' desc, i.due_at nulls last, i.created_at, i.id`, [dealId]);
}

export function appointments(db: Queryable, dealId: string): Promise<Appointment[]> {
  return db.query<Appointment>(`
    select a.id, a.scheduled_for as "scheduledFor", a.status, s.name as "confirmedBy",
      a.confirmed_at as "confirmedAt", a.outcome_note as "outcomeNote"
    from public.appointments a
    left join public.staff_users s on s.id = a.confirmed_by
    where a.deal_id = $1
    order by a.scheduled_for, a.id`, [dealId]);
}

export interface BuyerContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredChannel: string;
  optedOut: boolean;
}

export interface OtherDeal {
  dealId: string;
  vehicleInterest: string;
  stage: string;
  owner: string | null;
}

const buyerColumns = `id, name, email, phone, preferred_channel as "preferredChannel", opted_out as "optedOut"`;

// Held until the transaction ends, so two requests for the same email or phone
// at once cannot both create a new buyer.
export async function lockContact(db: Queryable, key: string) {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
}

// Existing buyers with this email (any case) or these phone digits.
export function buyersByContact(db: Queryable, email: string | null, digits: string | null): Promise<BuyerContact[]> {
  return db.query<BuyerContact>(`
    select ${buyerColumns} from public.buyers
    where ($1::text is not null and lower(email) = $1)
      or ($2::text is not null and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = $2)
    order by created_at, id`, [email, digits]);
}

// Adds a contact detail the buyer did not have; never overwrites one.
export async function fillMissingContact(db: Queryable, buyerId: string, email: string | null,
  phone: string | null): Promise<BuyerContact> {
  const [buyer] = await db.query<BuyerContact>(`
    update public.buyers set email = coalesce(email, $2), phone = coalesce(phone, $3)
    where id = $1 returning ${buyerColumns}`, [buyerId, email, phone]);
  return buyer;
}

export async function insertBuyer(db: Queryable, input: NewDeal): Promise<BuyerContact> {
  const [buyer] = await db.query<BuyerContact>(`
    insert into public.buyers (name, email, phone, preferred_channel)
    values ($1, $2, $3, $4) returning ${buyerColumns}`,
  [input.name, input.email, input.phone, input.preferredChannel]);
  return buyer;
}

export async function insertDeal(db: Queryable, buyerId: string, ownerId: string | null,
  input: NewDeal): Promise<{ id: string; stage: string }> {
  const [deal] = await db.query<{ id: string; stage: string }>(`
    insert into public.deals (buyer_id, owner_id, vehicle_interest, source, stage)
    values ($1, $2, $3, $4, case when $2::uuid is null then 'new' else 'assigned' end)
    returning id, stage`, [buyerId, ownerId, input.vehicleInterest, input.source]);
  return deal;
}

// The first timeline entry of a deal nobody owns yet.
export async function addNoteEvent(db: Queryable, dealId: string, actor: { id: string; role: string },
  body: string): Promise<{ id: string }> {
  const [event] = await db.query<{ id: string }>(`
    insert into public.timeline_events (deal_id, actor_type, actor_id, channel, direction, body)
    values ($1, $2, $3, 'note', 'internal', $4) returning id`, [dealId, actor.role, actor.id, body]);
  return event;
}

// The buyer's other open deals, so a duplicate entry is easy to spot.
export function otherOpenDeals(db: Queryable, buyerId: string, exceptDealId: string): Promise<OtherDeal[]> {
  return db.query<OtherDeal>(`
    select d.id as "dealId", d.vehicle_interest as "vehicleInterest", d.stage, o.name as owner
    from public.deals d left join public.staff_users o on o.id = d.owner_id
    where d.buyer_id = $1 and d.id <> $2 and d.stage not in ('delivered', 'lost')
    order by d.created_at, d.id`, [buyerId, exceptDealId]);
}
