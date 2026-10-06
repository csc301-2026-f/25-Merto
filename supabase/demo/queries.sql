-- Run these queries individually in Supabase SQL Editor after migration + seed.

-- 1. GM overview: 4 deals, including an unassigned buyer and a closed lost deal.
select b.name as buyer, d.vehicle_interest, d.stage,
  coalesce(s.name, 'Unassigned') as owner, b.opted_out,
  (select count(*) from public.open_items i
    where i.deal_id = d.id and i.status = 'open') as open_item_count
from public.deals d
join public.buyers b on b.id = d.buyer_id
left join public.staff_users s on s.id = d.owner_id
order by d.created_at, d.id;

-- 2. Dana's active deals: Jordan and Hannah. This filter is not an auth policy.
select b.name as buyer, d.vehicle_interest, d.stage
from public.deals d
join public.buyers b on b.id = d.buyer_id
where d.owner_id = '10000000-0000-0000-0000-000000000002'
  and d.stage not in ('delivered', 'lost')
order by b.name;

-- 3. Hannah's shared history: Arjun's original note remains after the transfer.
select e.created_at, e.actor_type, s.name as staff_actor,
  e.channel, e.direction, e.body
from public.timeline_events e
left join public.staff_users s on s.id = e.actor_id
where e.deal_id = '30000000-0000-0000-0000-000000000002'
order by e.created_at, e.id;

-- 4. Pending work: 3 open items, including 2 overdue items.
select b.name as buyer, i.description, coalesce(s.name, 'Unassigned') as task_owner,
  i.due_at, i.due_at < now() as overdue
from public.open_items i
join public.deals d on d.id = i.deal_id
join public.buyers b on b.id = d.buyer_id
left join public.staff_users s on s.id = i.owner_id
where i.status = 'open' and d.stage not in ('delivered', 'lost')
order by i.due_at nulls last, i.id;

-- 5. Appointment status: Jordan is confirmed; Nina is only requested.
select b.name as buyer, a.scheduled_for, a.status, s.name as confirmed_by
from public.appointments a
join public.deals d on d.id = a.deal_id
join public.buyers b on b.id = d.buyer_id
left join public.staff_users s on s.id = a.confirmed_by
order by a.scheduled_for, a.id;

-- 6. One deterministic AI check: any outbound message after an opt-out event?
-- Expected: no rows. This uses the event time, not just current buyer status.
select b.name as buyer, outbound.body, outbound.created_at
from public.timeline_events outbound
join public.deals d on d.id = outbound.deal_id
join public.buyers b on b.id = d.buyer_id
where outbound.direction = 'outbound'
  and exists (
    select 1 from public.timeline_events opt_out
    join public.deals opt_out_deal on opt_out_deal.id = opt_out.deal_id
    where opt_out_deal.buyer_id = b.id
      and opt_out.event_type = 'opt_out'
      and outbound.created_at >= opt_out.created_at
  );
