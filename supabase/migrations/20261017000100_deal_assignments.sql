-- Structured ownership history for assigning and transferring a buyer (US8).
-- The timeline event stays the readable entry everyone sees; this row records
-- who did it, when, from whom, to whom, and why, so queries never parse text.
begin;

create table public.deal_assignments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  kind text not null check (kind in ('assignment', 'transfer')),
  -- Null exactly for an assignment: the deal had no owner before.
  from_owner_id uuid references public.staff_users(id),
  to_owner_id uuid not null references public.staff_users(id),
  assigned_by uuid not null references public.staff_users(id),
  reason text not null check (btrim(reason) <> ''),
  -- Open items whose owner moved with the deal.
  open_items_moved integer not null default 0 check (open_items_moved >= 0),
  -- The matching timeline entry, on the same deal, used by at most one record.
  timeline_event_id uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (timeline_event_id, deal_id) references public.timeline_events(id, deal_id),
  check ((kind = 'assignment') = (from_owner_id is null)),
  check (from_owner_id is distinct from to_owner_id)
);

create index deal_assignments_deal_time_idx on public.deal_assignments(deal_id, created_at, id);

-- Same boundary as the other tables: only the server-side connection has access.
alter table public.deal_assignments enable row level security;
revoke all on public.deal_assignments from anon, authenticated;

commit;
