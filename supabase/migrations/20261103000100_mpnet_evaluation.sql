-- MPNet gets its own results/reviews while using the same deals and evidence.
-- Existing deterministic results and reviewer decisions are left in place.
begin;

create table public.mpnet_evaluations (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references public.deals(id),
  result text not null check (result in ('passed', 'flagged')),
  evaluated_at timestamptz not null default now()
);

create table public.mpnet_flags (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.mpnet_evaluations(deal_id),
  evidence_event_id uuid not null,
  flag_type text not null check (flag_type in (
    'appointment_certainty', 'unsupported_availability', 'unsupported_price',
    'missed_escalation', 'missed_price_handoff', 'ignored_opt_out', 'tone'
  )),
  severity text not null check (severity in ('low', 'medium', 'high')),
  explanation text not null check (btrim(explanation) <> ''),
  review_status text not null default 'pending' check (review_status in (
    'pending', 'confirmed_issue', 'false_positive', 'resolved'
  )),
  reviewed_by uuid references public.staff_users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  foreign key (evidence_event_id, deal_id) references public.timeline_events(id, deal_id),
  unique (evidence_event_id, flag_type),
  check ((review_status = 'pending') = (reviewed_by is null)),
  check ((reviewed_by is null) = (reviewed_at is null))
);

create index mpnet_flags_deal_idx on public.mpnet_flags(deal_id);
create index mpnet_flags_pending_idx on public.mpnet_flags(created_at) where review_status = 'pending';
alter table public.mpnet_evaluations enable row level security;
alter table public.mpnet_flags enable row level security;
revoke all on public.mpnet_evaluations, public.mpnet_flags from anon, authenticated;

commit;
