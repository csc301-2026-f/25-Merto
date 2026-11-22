-- Apply on hosted Supabase after the backend that writes resolution metadata is live.
-- Backfill resolutions made by the previous backend and preserve newer resolutions.
begin;

update public.ai_flags
set resolved_by = reviewed_by, resolved_at = reviewed_at
where review_status = 'resolved' and resolved_by is null and resolved_at is null;

alter table public.ai_flags
  add constraint ai_flags_resolved_status_check
    check ((review_status = 'resolved') = (resolved_by is not null)),
  add constraint ai_flags_resolution_metadata_check
    check ((resolved_by is null) = (resolved_at is null));

update public.mpnet_flags
set resolved_by = reviewed_by, resolved_at = reviewed_at
where review_status = 'resolved' and resolved_by is null and resolved_at is null;

alter table public.mpnet_flags
  add constraint mpnet_flags_resolved_status_check
    check ((review_status = 'resolved') = (resolved_by is not null)),
  add constraint mpnet_flags_resolution_metadata_check
    check ((resolved_by is null) = (resolved_at is null));

commit;
