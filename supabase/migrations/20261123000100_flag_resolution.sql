-- Add resolution metadata before deploying the backend that writes it.
-- The previous backend can still resolve flags while these columns are nullable.
begin;

alter table public.ai_flags
  add column resolved_by uuid references public.staff_users(id),
  add column resolved_at timestamptz;

alter table public.mpnet_flags
  add column resolved_by uuid references public.staff_users(id),
  add column resolved_at timestamptz;

commit;
