-- Structured record for the base seed's transfer (Hannah, Arjun to Dana), so the
-- demo shows from/to/why without reading text. Older seeded assignment events have
-- no record; the API returns them as text-only history. Runs after seed.sql.
begin;

insert into public.deal_assignments (id, deal_id, kind, from_owner_id, to_owner_id,
  assigned_by, reason, open_items_moved, timeline_event_id, created_at)
select '70000000-0000-0000-0000-000000000001', e.deal_id, 'transfer',
  '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002',
  e.actor_id, 'Arjun is away. Quote still pending.', 1, e.id, e.created_at
from public.timeline_events e
where e.id = '40000000-0000-0000-0000-000000000007'
on conflict (id) do nothing;

commit;
