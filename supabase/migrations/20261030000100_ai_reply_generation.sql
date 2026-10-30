begin;

alter table public.reply_drafts drop constraint reply_drafts_source_check;
alter table public.reply_drafts add constraint reply_drafts_source_check
  check (source in ('simulated_template', 'groq_ai'));
alter table public.reply_drafts
  add column model text,
  add column prompt_version text;
alter table public.reply_drafts add constraint reply_drafts_ai_metadata_check
  check (source <> 'groq_ai' or (
    model is not null and btrim(model) <> ''
    and prompt_version is not null and btrim(prompt_version) <> ''
    and context ? 'activityVersion'
    and jsonb_typeof(context->'activityVersion') = 'string'
  ));

commit;
