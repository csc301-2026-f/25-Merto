import type { Queryable } from '../db.ts';
import type { Staff } from '../auth.ts';
import type { FollowUpDeal } from './repository.ts';
import type { FollowUpChannel } from './send-policy.ts';

export interface ContactableDeal extends FollowUpDeal {
  email: string | null;
  phone: string | null;
}

export interface RecordedFollowUp {
  id: string;
  dealId: string;
  eventType: string;
  actorId: string | null;
  actorType: string;
  direction: string;
  channel: string;
  body: string;
  createdAt: Date;
}

const eventColumns = `id, deal_id as "dealId", event_type as "eventType", actor_id as "actorId",
  actor_type as "actorType", direction, channel, body, created_at as "createdAt"`;

export async function lockRequest(db: Queryable, requestId: string) {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [requestId]);
}

// Keep ownership and buyer contact details stable while recording the follow-up.
export async function lockDeal(db: Queryable, dealId: string): Promise<ContactableDeal | undefined> {
  const [deal] = await db.query<ContactableDeal>(`
    select d.id as "dealId", b.id as "buyerId", b.name as buyer, b.email, b.phone,
      d.vehicle_interest as "vehicleInterest", d.stage, d.owner_id as "ownerId",
      o.name as owner, b.opted_out as "optedOut", d.created_at as "createdAt"
    from public.deals d join public.buyers b on b.id = d.buyer_id
    left join public.staff_users o on o.id = d.owner_id
    where d.id = $1 for update of d, b`, [dealId]);
  return deal;
}

export async function findRecorded(db: Queryable, requestId: string): Promise<RecordedFollowUp | undefined> {
  return (await db.query<RecordedFollowUp>(`select ${eventColumns} from public.timeline_events where id = $1`, [requestId]))[0];
}

export async function record(db: Queryable, input: {
  requestId: string; dealId: string; actor: Staff; channel: FollowUpChannel; body: string;
}): Promise<RecordedFollowUp> {
  return (await db.query<RecordedFollowUp>(`
    insert into public.timeline_events (id, deal_id, actor_type, actor_id, channel, direction, body)
    values ($1, $2, $3, $4, $5, 'outbound', $6) returning ${eventColumns}`,
  [input.requestId, input.dealId, input.actor.role, input.actor.id, input.channel, input.body]))[0];
}
