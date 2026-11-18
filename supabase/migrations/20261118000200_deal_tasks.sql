-- Tasks: a rep's own to-do list on a deal ("call the bank", "book the
-- detail"). Unlike open_items, which record what the buyer is waiting on, a
-- task is internal work the rep writes for themselves. Tasks belong to the deal,
-- so whoever owns the deal owns its tasks, and they move with a transfer.
begin;

create table public.deal_tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  title text not null check (btrim(title) <> '' and length(title) <= 200),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed')),
  created_by uuid not null references public.staff_users(id),
  created_at timestamptz not null default now(),
  completed_by uuid references public.staff_users(id),
  completed_at timestamptz,
  check ((status = 'completed') = (completed_at is not null)),
  check ((completed_by is null) = (completed_at is null))
);

create index deal_tasks_deal_idx on public.deal_tasks(deal_id, created_at, id);
create index deal_tasks_open_due_idx on public.deal_tasks(due_at) where status = 'open';

-- Server-side access only, as for every other table.
alter table public.deal_tasks enable row level security;
revoke all on public.deal_tasks from anon, authenticated;

commit;
