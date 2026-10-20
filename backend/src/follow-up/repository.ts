// SQL for US6. Reads only: the core tables from supabase/DATA_CONTRACT.md. Every
// value is a bound parameter. Loads many deals in a few queries, not one per deal.
import type { Queryable } from '../db.ts';
import type { DealActivity, FollowUpAppointment, FollowUpEvent, FollowUpOpenItem } from './detect.ts';

export interface FollowUpDeal {
  dealId: string;
  buyerId: string;
  buyer: string;
  vehicleInterest: string;
  stage: string;
  ownerId: string | null;
  owner: string | null;
  optedOut: boolean;
  createdAt: Date;
}

const dealColumns = `d.id as "dealId", b.id as "buyerId", b.name as buyer,
  d.vehicle_interest as "vehicleInterest", d.stage, d.owner_id as "ownerId", o.name as owner,
  b.opted_out as "optedOut", d.created_at as "createdAt"`;
const dealJoins = `from public.deals d
  join public.buyers b on b.id = d.buyer_id
  left join public.staff_users o on o.id = d.owner_id`;

// Open deals (not delivered or lost). ownerId null lists every deal, unassigned
// included; otherwise only that rep's.
export function openDeals(db: Queryable, ownerId: string | null): Promise<FollowUpDeal[]> {
  return db.query<FollowUpDeal>(`
    select ${dealColumns} ${dealJoins}
    where d.stage not in ('delivered', 'lost') and ($1::uuid is null or d.owner_id = $1)
    order by d.id`, [ownerId]);
}

export async function findDeal(db: Queryable, dealId: string): Promise<FollowUpDeal | undefined> {
  const [deal] = await db.query<FollowUpDeal>(`select ${dealColumns} ${dealJoins} where d.id = $1`, [dealId]);
  return deal;
}

type WithDeal<T> = T & { dealId: string };

const groupByDeal = <T>(rows: WithDeal<T>[]) => {
  const groups = new Map<string, T[]>();
  for (const { dealId, ...row } of rows) {
    const group = groups.get(dealId) ?? [];
    group.push(row as T);
    groups.set(dealId, group);
  }
  return groups;
};

// Each deal's activity, keyed by deal ID. Reads run in sequence so this also
// works on a single transaction connection.
export async function loadActivity(db: Queryable, deals: FollowUpDeal[]): Promise<Map<string, DealActivity>> {
  const dealIds = deals.map((deal) => deal.dealId);
  const buyerIds = [...new Set(deals.map((deal) => deal.buyerId))];
  const events = groupByDeal(await db.query<WithDeal<FollowUpEvent>>(`
    select deal_id as "dealId", id, event_type as "eventType", actor_type as "actorType", channel,
      direction, body, created_at as "createdAt"
    from public.timeline_events where deal_id = any($1::uuid[])
    order by created_at, id`, [dealIds]));
  const appointments = groupByDeal(await db.query<WithDeal<FollowUpAppointment>>(`
    select deal_id as "dealId", id, scheduled_for as "scheduledFor", status
    from public.appointments where deal_id = any($1::uuid[])
    order by scheduled_for, id`, [dealIds]));
  const openItems = groupByDeal(await db.query<WithDeal<FollowUpOpenItem>>(`
    select deal_id as "dealId", id, type, description, status, due_at as "dueAt"
    from public.open_items where deal_id = any($1::uuid[])
    order by due_at nulls last, id`, [dealIds]));
  // Opt-outs on any of the buyer's deals, as in demo query 06.
  const optOuts = new Map<string, Date[]>();
  for (const row of await db.query<{ buyerId: string; at: Date }>(`
    select d.buyer_id as "buyerId", e.created_at as at
    from public.timeline_events e join public.deals d on d.id = e.deal_id
    where d.buyer_id = any($1::uuid[]) and e.event_type = 'opt_out'`, [buyerIds])) {
    optOuts.set(row.buyerId, [...optOuts.get(row.buyerId) ?? [], row.at]);
  }

  return new Map(deals.map((deal) => [deal.dealId, {
    stage: deal.stage,
    createdAt: deal.createdAt,
    buyerOptedOut: deal.optedOut,
    optOutAts: optOuts.get(deal.buyerId) ?? [],
    events: events.get(deal.dealId) ?? [],
    appointments: appointments.get(deal.dealId) ?? [],
    openItems: openItems.get(deal.dealId) ?? [],
  }]));
}
