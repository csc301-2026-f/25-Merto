-- Which evaluator version produced each result, so GM reviews can be scored per
-- model version and exported as training labels for the next one.
-- - <store>_evaluations.model_version: the version of the deal's latest run.
-- - <store>_flags.model_version: for an evaluator flag, the version of the run
--   that raised it; for a manual flag, the version of the run that missed it.
-- Null for the deterministic rules, and for rows saved before this column existed.
begin;

alter table public.ai_evaluations
  add column model_version text check (model_version is null or btrim(model_version) <> '');
alter table public.ai_flags
  add column model_version text check (model_version is null or btrim(model_version) <> '');
alter table public.mpnet_evaluations
  add column model_version text check (model_version is null or btrim(model_version) <> '');
alter table public.mpnet_flags
  add column model_version text check (model_version is null or btrim(model_version) <> '');

commit;
