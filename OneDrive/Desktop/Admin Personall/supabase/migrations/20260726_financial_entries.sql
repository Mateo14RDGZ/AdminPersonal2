create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'saving')),
  name text not null check (char_length(name) between 1 and 120),
  amount numeric not null check (amount > 0),
  is_recurring boolean not null default false,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists financial_entries_user_date_idx
  on public.financial_entries(user_id, occurred_at desc);

alter table public.financial_entries enable row level security;

drop policy if exists "financial_entries_select_own" on public.financial_entries;
create policy "financial_entries_select_own" on public.financial_entries
  for select using (auth.uid() = user_id);

drop policy if exists "financial_entries_insert_own" on public.financial_entries;
create policy "financial_entries_insert_own" on public.financial_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "financial_entries_update_own" on public.financial_entries;
create policy "financial_entries_update_own" on public.financial_entries
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "financial_entries_delete_own" on public.financial_entries;
create policy "financial_entries_delete_own" on public.financial_entries
  for delete using (auth.uid() = user_id);
