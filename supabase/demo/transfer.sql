-- Optional live demo. Run the WHOLE file together in the SQL Editor.
-- Transfer Hannah back to Arjun, move her open task, and record the GM action
-- atomically. ROLLBACK makes this demonstration repeatable without reseeding.
begin;

update public.deals
set owner_id = '10000000-0000-0000-0000-000000000003'
where id = '30000000-0000-0000-0000-000000000002';

update public.open_items
set owner_id = '10000000-0000-0000-0000-000000000003'
where deal_id = '30000000-0000-0000-0000-000000000002' and status = 'open';

insert into public.timeline_events (deal_id, event_type, actor_type, actor_id, channel, direction, body)
values ('30000000-0000-0000-0000-000000000002', 'transfer', 'gm',
  '10000000-0000-0000-0000-000000000001', 'note', 'internal',
  'Transferred Hannah from Dana to Arjun: Arjun is back on shift.');

select b.name as buyer, s.name as current_owner, e.actor_type, e.body, e.created_at
from public.deals d
join public.buyers b on b.id = d.buyer_id
join public.staff_users s on s.id = d.owner_id
join public.timeline_events e on e.deal_id = d.id
where d.id = '30000000-0000-0000-0000-000000000002'
order by e.created_at, e.id;

rollback;
