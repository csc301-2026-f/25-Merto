-- A second opinion on GM reviews that strongly disagree with the model, before
-- they may train it (backend/src/evaluation/training-labels.ts).
-- - model_score: the model's probability for the flag's wording signal on the
--   reviewed message, recorded when the GM decides. Null for the deterministic
--   rules, or when the message cannot be scored.
-- - second_review: 'agree' or 'disagree' from a second GM, who must not be the
--   first reviewer. Cleared whenever the first review changes.
begin;

alter table public.ai_flags
  add column model_score real check (model_score between 0 and 1),
  add column second_review text check (second_review in ('agree', 'disagree')),
  add column second_reviewed_by uuid references public.staff_users(id),
  add column second_reviewed_at timestamptz,
  add check ((second_review is null) = (second_reviewed_by is null)),
  add check ((second_review is null) = (second_reviewed_at is null)),
  add check (second_review is null or review_status <> 'pending'),
  add check (second_reviewed_by is null or second_reviewed_by <> reviewed_by);

alter table public.mpnet_flags
  add column model_score real check (model_score between 0 and 1),
  add column second_review text check (second_review in ('agree', 'disagree')),
  add column second_reviewed_by uuid references public.staff_users(id),
  add column second_reviewed_at timestamptz,
  add check ((second_review is null) = (second_reviewed_by is null)),
  add check ((second_review is null) = (second_reviewed_at is null)),
  add check (second_review is null or review_status <> 'pending'),
  add check (second_reviewed_by is null or second_reviewed_by <> reviewed_by);

commit;
