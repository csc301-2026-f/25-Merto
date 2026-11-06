-- Recover historical request times from the deal timeline where possible.
-- Some imported appointments have no request event, so NULL is more honest
-- than displaying the migration timestamp as if it were the request time.
begin;

alter table public.appointments alter column created_at drop not null;

update public.appointments a
set created_at = coalesce(
  (
    select e.created_at
    from public.audit_events e
    where e.entity_type = 'appointment'
      and e.entity_id = a.id
      and e.action = 'request_appointment'
      and e.field_name = 'status'
      and e.new_value = 'requested'
    order by e.created_at, e.id
    limit 1
  ),
  (
    select e.created_at
    from public.timeline_events e
    where e.deal_id = a.deal_id
      and e.event_type = 'appointment'
      and e.actor_type in ('ai', 'rep', 'gm')
      and e.body ilike '%request%'
    order by e.created_at, e.id
    limit 1
  ),
  (
    select e.created_at
    from public.timeline_events e
    where e.deal_id = a.deal_id
      and e.actor_type = 'buyer'
      and e.direction = 'inbound'
      and e.created_at <= coalesce(a.confirmed_at, a.scheduled_for, now())
      and e.body ~* '(come in|come by|visit|appointment|test[- ]?drive|see (the|a|this|that))'
    order by e.created_at desc, e.id desc
    limit 1
  ),
  (
    select e.created_at
    from public.timeline_events e
    where e.deal_id = a.deal_id
      and e.actor_type = 'ai'
      and e.direction = 'outbound'
      and e.body ~* '(visit request is recorded|person will confirm|confirm the visit)'
      and e.created_at <= coalesce(a.confirmed_at, a.scheduled_for, now())
    order by e.created_at, e.id
    limit 1
  ),
  null
);

comment on column public.appointments.created_at is
  'When the request was recorded. Null for historical appointments whose request time cannot be recovered.';

commit;
