-- Storage for conversation evaluation (US5). The backend evaluation service
-- decides what to flag; these tables keep its results and the GM's decisions.
begin;

-- Lets ai_flags require that its evidence message belongs to the flagged deal.
alter table public.timeline_events
  add constraint timeline_events_id_deal_key unique (id, deal_id);

-- Evaluations and GM reviews are written to the shared timeline.
alter table public.timeline_events drop constraint timeline_events_event_type_check;
alter table public.timeline_events add constraint timeline_events_event_type_check
  check (event_type in (
    'interaction', 'assignment', 'transfer', 'opt_out', 'ai_evaluation', 'ai_review'
  ));

-- The latest evaluation of a deal's AI conversation: at most one per deal.
create table public.ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references public.deals(id),
  result text not null check (result in ('passed', 'flagged')),
  evaluated_at timestamptz not null default now()
);

-- One issue on one message, plus the GM's review of it.
create table public.ai_flags (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.ai_evaluations(deal_id),
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
  -- Re-running the evaluation never flags the same message for the same issue twice.
  unique (evidence_event_id, flag_type),
  check ((review_status = 'pending') = (reviewed_by is null)),
  check ((reviewed_by is null) = (reviewed_at is null))
);

create index ai_flags_deal_idx on public.ai_flags(deal_id);
create index ai_flags_pending_idx on public.ai_flags(created_at) where review_status = 'pending';

-- Same boundary as the first migration: only the server-side connection reads
-- and writes these tables until Supabase Auth and Rep/GM policies exist.
alter table public.ai_evaluations enable row level security;
alter table public.ai_flags enable row level security;
revoke all on public.ai_evaluations, public.ai_flags from anon, authenticated;

commit;
