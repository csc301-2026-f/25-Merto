-- Small database-only MVP for the TA demo. All dates include a timezone.
begin;

create table public.staff_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  role text not null check (role in ('gm', 'rep')),
  email text not null unique
);

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  email text,
  phone text,
  preferred_channel text not null default 'email'
    check (preferred_channel in ('sms', 'email', 'call')),
  opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id),
  owner_id uuid references public.staff_users(id),
  vehicle_interest text not null,
  source text not null,
  stage text not null default 'new' check (stage in (
    'new', 'assigned', 'engaged', 'appointment_set', 'visited',
    'working', 'fni', 'delivered', 'lost', 'dormant'
  )),
  lost_reason text,
  created_at timestamptz not null default now(),
  check (stage <> 'lost' or nullif(btrim(lost_reason), '') is not null)
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  event_type text not null default 'interaction'
    check (event_type in ('interaction', 'assignment', 'transfer', 'opt_out')),
  actor_type text not null check (actor_type in ('buyer', 'ai', 'rep', 'gm', 'system')),
  actor_id uuid references public.staff_users(id),
  channel text not null check (channel in ('call', 'sms', 'email', 'web', 'in_person', 'note')),
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now(),
  check (
    (actor_type in ('rep', 'gm') and actor_id is not null)
    or (actor_type in ('buyer', 'ai', 'system') and actor_id is null)
  )
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  scheduled_for timestamptz not null,
  status text not null default 'requested' check (status in (
    'requested', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'
  )),
  confirmed_by uuid references public.staff_users(id),
  confirmed_at timestamptz,
  outcome_note text,
  check ((confirmed_by is null) = (confirmed_at is null)),
  check (status not in ('confirmed', 'completed', 'no_show') or confirmed_by is not null),
  check (status <> 'requested' or confirmed_by is null)
);

create table public.open_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  owner_id uuid references public.staff_users(id),
  type text not null check (type in ('promise', 'missing_doc', 'unanswered_question', 'callback')),
  description text not null check (btrim(description) <> ''),
  status text not null default 'open' check (status in ('open', 'resolved', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'resolved') = (resolved_at is not null))
);

create index deals_owner_idx on public.deals(owner_id);
create index deals_buyer_idx on public.deals(buyer_id);
create index timeline_deal_time_idx on public.timeline_events(deal_id, created_at, id);
create index appointments_deal_idx on public.appointments(deal_id);
create index open_items_deal_idx on public.open_items(deal_id);

-- This demo uses the SQL Editor only. No browser/API access is granted yet.
-- Add Supabase Auth mappings and Rep/GM policies before connecting a frontend.
alter table public.staff_users enable row level security;
alter table public.buyers enable row level security;
alter table public.deals enable row level security;
alter table public.timeline_events enable row level security;
alter table public.appointments enable row level security;
alter table public.open_items enable row level security;
revoke all on public.staff_users, public.buyers, public.deals,
  public.timeline_events, public.appointments, public.open_items
  from anon, authenticated;

commit;
