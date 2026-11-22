-- Who followed up a confirmed problem, kept apart from who judged the flag.
-- Resolving sets resolved_by and resolved_at and leaves reviewed_by, the
-- review note and reason, the model score and any second opinion as they
-- were, so follow-up work never changes a judgment that trains the model.
begin;

alter table public.ai_flags
  add column resolved_by uuid references public.staff_users(id),
  add column resolved_at timestamptz;
update public.ai_flags set resolved_by = reviewed_by, resolved_at = reviewed_at where review_status = 'resolved';
alter table public.ai_flags
  add check ((review_status = 'resolved') = (resolved_by is not null)),
  add check ((resolved_by is null) = (resolved_at is null));

alter table public.mpnet_flags
  add column resolved_by uuid references public.staff_users(id),
  add column resolved_at timestamptz;
update public.mpnet_flags set resolved_by = reviewed_by, resolved_at = reviewed_at where review_status = 'resolved';
alter table public.mpnet_flags
  add check ((review_status = 'resolved') = (resolved_by is not null)),
  add check ((resolved_by is null) = (resolved_at is null));

commit;
