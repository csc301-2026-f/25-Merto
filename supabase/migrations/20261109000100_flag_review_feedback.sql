-- GM feedback on AI flags, for both evaluators' flag tables:
-- - review_reason: why a flag was a false positive, so wording mistakes can be
--   told apart from flags that were wrong only because of the deal's situation.
-- - source: 'evaluator' flags come from an evaluation run; 'manual' flags are
--   problems a GM found on a reply the evaluator did not flag.
-- - created_by: the GM who added a manual flag.
begin;

alter table public.ai_flags
  add column source text not null default 'evaluator' check (source in ('evaluator', 'manual')),
  add column created_by uuid references public.staff_users(id),
  add column review_reason text check (review_reason in (
    'misread_wording', 'already_handled', 'visit_confirmed', 'not_a_problem', 'other'
  )),
  add check ((source = 'manual') = (created_by is not null)),
  add check (review_reason is null or review_status = 'false_positive');

alter table public.mpnet_flags
  add column source text not null default 'evaluator' check (source in ('evaluator', 'manual')),
  add column created_by uuid references public.staff_users(id),
  add column review_reason text check (review_reason in (
    'misread_wording', 'already_handled', 'visit_confirmed', 'not_a_problem', 'other'
  )),
  add check ((source = 'manual') = (created_by is not null)),
  add check (review_reason is null or review_status = 'false_positive');

commit;
