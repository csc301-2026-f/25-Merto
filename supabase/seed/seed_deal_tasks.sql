-- Sample tasks so the deal page, the rep homepage, and the Tasks page have
-- something to show. Dana has one overdue and one upcoming task; Chris's deal
-- (Arjun) has one done. Runs after seed.sql and seed_ai_evaluation.sql.
begin;

insert into public.deal_tasks (id, deal_id, title, due_at, status, created_by, created_at, completed_by, completed_at) values
  ('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
    'Ask finance for the CR-V lease residual', now() - interval '3 hours', 'open',
    '10000000-0000-0000-0000-000000000002', now() - interval '1 day', null, null),
  ('80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
    'Have the RAV4 detailed before the visit', now() + interval '20 hours', 'open',
    '10000000-0000-0000-0000-000000000002', now() - interval '6 hours', null, null),
  ('80000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006',
    'Check which trucks are still on the lot', null, 'completed',
    '10000000-0000-0000-0000-000000000003', now() - interval '2 days',
    '10000000-0000-0000-0000-000000000003', now() - interval '1 day')
on conflict (id) do nothing;

commit;
