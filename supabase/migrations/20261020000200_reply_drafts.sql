begin;

alter table public.timeline_events drop constraint timeline_events_event_type_check;
alter table public.timeline_events add constraint timeline_events_event_type_check
  check (event_type in ('interaction', 'assignment', 'transfer', 'opt_out',
    'ai_evaluation', 'ai_review', 'open_item', 'draft_review'));

create table public.reply_drafts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  channel text not null check (channel in ('email', 'sms')),
  source text not null default 'simulated_template' check (source = 'simulated_template'),
  original_text text not null check (btrim(original_text) <> '' and length(original_text) <= 2000),
  context jsonb not null check (jsonb_typeof(context) = 'object'
    and context ?& array['buyer', 'vehicleInterest', 'reasons', 'messages']),
  created_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  decision text check (decision in ('approve', 'edit', 'reject')),
  final_text text check (btrim(final_text) <> '' and length(final_text) <= 2000),
  reviewed_by uuid references public.staff_users(id),
  reviewed_at timestamptz,
  review_event_id uuid unique,
  sent_event_id uuid unique,
  foreign key (review_event_id, deal_id) references public.timeline_events(id, deal_id),
  foreign key (sent_event_id, deal_id) references public.timeline_events(id, deal_id),
  check (
    (decision is null and final_text is null and reviewed_by is null
      and reviewed_at is null and review_event_id is null)
    or (decision is not null and reviewed_by is not null and reviewed_at is not null
      and review_event_id is not null and (
        (decision = 'reject' and final_text is null)
        or (decision = 'approve' and final_text is not null and final_text = original_text)
        or (decision = 'edit' and final_text is not null and final_text <> original_text)
      ))
  ),
  check (sent_event_id is null or (decision is not null and decision in ('approve', 'edit')))
);

create index reply_drafts_deal_time_idx on public.reply_drafts(deal_id, created_at, id);
alter table public.reply_drafts enable row level security;
revoke all on public.reply_drafts from anon, authenticated;

commit;
