-- Appointment attribution, transition history, and unresolved visit outcomes.
begin;

alter table public.appointments
  add column requested_by_type text not null default 'system'
    check (requested_by_type in ('ai', 'system', 'rep', 'gm')),
  add column requested_by_id uuid references public.staff_users(id),
  add column created_at timestamptz not null default now();

alter table public.appointments
  add constraint appointments_request_actor_check
  check (
    (requested_by_type in ('rep', 'gm') and requested_by_id is not null)
    or (requested_by_type in ('ai', 'system') and requested_by_id is null)
  );

alter table public.open_items drop constraint open_items_type_check;
alter table public.open_items add constraint open_items_type_check
  check (type in ('promise', 'missing_doc', 'unanswered_question', 'callback', 'visit_outcome'));
alter table public.open_items
  add column appointment_id uuid unique references public.appointments(id);

alter table public.timeline_events drop constraint timeline_events_event_type_check;
alter table public.timeline_events add constraint timeline_events_event_type_check
  check (event_type in (
    'interaction', 'assignment', 'transfer', 'opt_out', 'ai_evaluation', 'ai_review',
    'open_item', 'draft_review', 'appointment'
  ));

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('ai', 'system', 'rep', 'gm')),
  actor_id uuid references public.staff_users(id),
  action text not null check (btrim(action) <> ''),
  entity_type text not null check (entity_type in ('appointment', 'deal')),
  entity_id uuid not null,
  deal_id uuid not null references public.deals(id),
  field_name text not null check (btrim(field_name) <> ''),
  old_value text,
  new_value text,
  created_at timestamptz not null default now(),
  check (
    (actor_type in ('rep', 'gm') and actor_id is not null)
    or (actor_type in ('ai', 'system') and actor_id is null)
  )
);

create index audit_events_entity_time_idx on public.audit_events(entity_type, entity_id, created_at, id);
create index appointments_status_scheduled_idx on public.appointments(status, scheduled_for);
create index open_items_appointment_idx on public.open_items(appointment_id) where appointment_id is not null;

alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;

commit;
