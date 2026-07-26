-- Core financial model. Additive and safe for existing installations.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  institution text,
  type text not null default 'OTHER'
    check (type in ('CASH', 'CHECKING', 'SAVINGS', 'DIGITAL_WALLET', 'OTHER')),
  currency text not null default 'UYU' check (currency ~ '^[A-Z]{3}$'),
  initial_balance numeric(18,2) not null default 0,
  current_balance numeric(18,2) not null default 0,
  icon text not null default 'wallet',
  color text not null default '#1D9E75',
  is_savings_account boolean not null default false,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accounts_one_default_per_currency
  on public.accounts(user_id, currency) where is_default and not is_archived;
create index if not exists accounts_user_idx on public.accounts(user_id, is_archived);

insert into public.accounts (
  user_id, name, type, currency, initial_balance, current_balance, is_default
)
select id, 'Cuenta principal', 'OTHER', 'UYU', 0, 0, true
from auth.users
where not exists (
  select 1 from public.accounts where accounts.user_id = auth.users.id
);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  institution text,
  currency text not null default 'UYU' check (currency ~ '^[A-Z]{3}$'),
  credit_limit numeric(18,2) not null default 0 check (credit_limit >= 0),
  current_used_amount numeric(18,2) not null default 0 check (current_used_amount >= 0),
  closing_day integer check (closing_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_cards_user_idx
  on public.credit_cards(user_id, is_archived);

alter table public.transactions
  add column if not exists type text not null default 'EXPENSE',
  add column if not exists currency text not null default 'UYU',
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists destination_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists credit_card_id uuid references public.credit_cards(id) on delete set null,
  add column if not exists description text,
  add column if not exists notes text,
  add column if not exists status text not null default 'CONFIRMED',
  add column if not exists external_id text,
  add column if not exists fingerprint text,
  add column if not exists idempotency_key text,
  add column if not exists confidence numeric(4,3),
  add column if not exists raw_input text,
  add column if not exists receipt_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.transactions
  drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (
  type in (
    'EXPENSE', 'INCOME', 'TRANSFER', 'CREDIT_CARD_PAYMENT', 'ADJUSTMENT',
    'LOAN_GIVEN', 'LOAN_RECEIVED', 'REFUND'
  )
);
alter table public.transactions
  drop constraint if exists transactions_currency_check;
alter table public.transactions add constraint transactions_currency_check
  check (currency ~ '^[A-Z]{3}$');
alter table public.transactions
  drop constraint if exists transactions_status_check;
alter table public.transactions add constraint transactions_status_check
  check (status in ('CONFIRMED', 'PENDING_REVIEW', 'ESTIMATED'));
alter table public.transactions
  drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in (
    'manual', 'shortcut', 'email', 'text', 'voice', 'siri',
    'import', 'receipt', 'recurring', 'system'
  ));
create unique index if not exists transactions_user_idempotency_idx
  on public.transactions(user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists transactions_user_type_date_idx
  on public.transactions(user_id, type, occurred_at desc);

update public.transactions t
set account_id = a.id
from public.accounts a
where t.user_id = a.user_id
  and t.account_id is null
  and a.is_default
  and a.currency = t.currency;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'UYU' check (currency ~ '^[A-Z]{3}$'),
  period text not null default 'MONTHLY'
    check (period in ('WEEKLY', 'MONTHLY', 'YEARLY')),
  start_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  target_amount numeric(18,2) not null check (target_amount > 0),
  current_amount numeric(18,2) not null default 0 check (current_amount >= 0),
  currency text not null default 'UYU' check (currency ~ '^[A-Z]{3}$'),
  target_date date,
  linked_account_id uuid references public.accounts(id) on delete set null,
  icon text not null default 'target',
  is_primary boolean not null default false,
  is_completed boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists savings_goals_one_primary
  on public.savings_goals(user_id) where is_primary and not is_archived;

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'EXPENSE',
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'UYU' check (currency ~ '^[A-Z]{3}$'),
  account_id uuid references public.accounts(id) on delete cascade,
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  merchant text,
  description text,
  frequency text not null default 'MONTHLY'
    check (frequency in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  interval_count integer not null default 1 check (interval_count > 0),
  next_execution_date date not null,
  start_date date not null default current_date,
  end_date date,
  auto_create boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchant_rules
  add column if not exists normalized_merchant text,
  add column if not exists preferred_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists preferred_currency text;

create table if not exists public.automation_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_tokens_user_idx
  on public.automation_tokens(user_id, is_active);

create table if not exists public.pending_transaction_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_input text not null,
  parsed_payload jsonb not null,
  source text not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  source_institution text,
  status text not null default 'PENDING',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  error_rows integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts', 'credit_cards', 'budgets', 'savings_goals',
    'recurring_transactions', 'automation_tokens',
    'pending_transaction_confirmations', 'audit_logs', 'import_batches'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      table_name || '_select_own', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name || '_update_own', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      table_name || '_delete_own', table_name
    );
  end loop;
end $$;

-- Token hashes and audit entries are server-only.
drop policy if exists automation_tokens_select_own on public.automation_tokens;
drop policy if exists automation_tokens_insert_own on public.automation_tokens;
drop policy if exists automation_tokens_update_own on public.automation_tokens;
drop policy if exists automation_tokens_delete_own on public.automation_tokens;
drop policy if exists audit_logs_insert_own on public.audit_logs;
drop policy if exists audit_logs_update_own on public.audit_logs;
drop policy if exists audit_logs_delete_own on public.audit_logs;

create or replace function public.create_financial_transaction(
  p_type text,
  p_amount numeric,
  p_currency text,
  p_account_id uuid,
  p_destination_account_id uuid default null,
  p_credit_card_id uuid default null,
  p_category_id uuid default null,
  p_merchant text default null,
  p_description text default null,
  p_notes text default null,
  p_occurred_at timestamptz default now(),
  p_source text default 'manual',
  p_status text default 'CONFIRMED',
  p_idempotency_key text default null,
  p_confidence numeric default null,
  p_raw_input text default null
) returns public.transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.transactions;
begin
  if uid is null then raise exception 'Unauthorized'; end if;
  if p_amount <= 0 then raise exception 'Invalid amount'; end if;
  if not exists (
    select 1 from accounts
    where id = p_account_id and user_id = uid and not is_archived and currency = p_currency
  ) then raise exception 'Invalid account'; end if;
  if p_destination_account_id is not null and not exists (
    select 1 from accounts
    where id = p_destination_account_id and user_id = uid and not is_archived and currency = p_currency
  ) then raise exception 'Invalid destination account'; end if;
  if p_category_id is not null and not exists (
    select 1 from categories where id = p_category_id and user_id = uid
  ) then raise exception 'Invalid category'; end if;

  if p_idempotency_key is not null then
    select * into result from transactions
    where user_id = uid and idempotency_key = p_idempotency_key;
    if found then return result; end if;
  end if;

  insert into transactions (
    user_id, type, amount, currency, account_id, destination_account_id,
    credit_card_id, category_id, merchant, description, notes, note,
    occurred_at, source, status, idempotency_key, confidence, raw_input
  ) values (
    uid, p_type, p_amount, p_currency, p_account_id, p_destination_account_id,
    p_credit_card_id, p_category_id, p_merchant, p_description, p_notes, p_notes,
    p_occurred_at, p_source, p_status, p_idempotency_key, p_confidence, p_raw_input
  ) returning * into result;

  if p_status = 'CONFIRMED' then
    if p_type in ('EXPENSE', 'LOAN_GIVEN') then
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = uid;
    elsif p_type in ('INCOME', 'REFUND', 'LOAN_RECEIVED') then
      update accounts set current_balance = current_balance + p_amount, updated_at = now()
      where id = p_account_id and user_id = uid;
    elsif p_type = 'TRANSFER' then
      if p_destination_account_id is null or p_destination_account_id = p_account_id then
        raise exception 'Invalid transfer destination';
      end if;
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = uid;
      update accounts set current_balance = current_balance + p_amount, updated_at = now()
      where id = p_destination_account_id and user_id = uid;
    elsif p_type = 'CREDIT_CARD_PAYMENT' then
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = uid;
      update credit_cards
      set current_used_amount = greatest(0, current_used_amount - p_amount), updated_at = now()
      where id = p_credit_card_id and user_id = uid;
    end if;
  end if;

  insert into audit_logs(user_id, action, entity_type, entity_id)
  values(uid, 'CREATE', 'TRANSACTION', result.id);
  return result;
end;
$$;

grant execute on function public.create_financial_transaction(
  text, numeric, text, uuid, uuid, uuid, uuid, text, text, text,
  timestamptz, text, text, text, numeric, text
) to authenticated;

create or replace function public.create_financial_transaction_service(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text,
  p_account_id uuid,
  p_destination_account_id uuid default null,
  p_category_id uuid default null,
  p_merchant text default null,
  p_description text default null,
  p_occurred_at timestamptz default now(),
  p_source text default 'siri',
  p_status text default 'CONFIRMED',
  p_idempotency_key text default null,
  p_confidence numeric default null,
  p_raw_input text default null
) returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare result public.transactions;
begin
  if p_amount <= 0 then raise exception 'Invalid amount'; end if;
  if not exists (
    select 1 from accounts
    where id = p_account_id and user_id = p_user_id
      and not is_archived and currency = p_currency
  ) then raise exception 'Invalid account'; end if;
  if p_destination_account_id is not null and not exists (
    select 1 from accounts
    where id = p_destination_account_id and user_id = p_user_id
      and not is_archived and currency = p_currency
  ) then raise exception 'Invalid destination account'; end if;

  if p_idempotency_key is not null then
    select * into result from transactions
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then return result; end if;
  end if;

  insert into transactions (
    user_id, type, amount, currency, account_id, destination_account_id,
    category_id, merchant, description, occurred_at, source, status,
    idempotency_key, confidence, raw_input
  ) values (
    p_user_id, p_type, p_amount, p_currency, p_account_id,
    p_destination_account_id, p_category_id, p_merchant, p_description,
    p_occurred_at, p_source, p_status, p_idempotency_key, p_confidence, p_raw_input
  ) returning * into result;

  if p_status = 'CONFIRMED' then
    if p_type in ('EXPENSE', 'LOAN_GIVEN') then
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = p_user_id;
    elsif p_type in ('INCOME', 'REFUND', 'LOAN_RECEIVED') then
      update accounts set current_balance = current_balance + p_amount, updated_at = now()
      where id = p_account_id and user_id = p_user_id;
    elsif p_type = 'TRANSFER' then
      if p_destination_account_id is null or p_destination_account_id = p_account_id then
        raise exception 'Invalid transfer destination';
      end if;
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = p_user_id;
      update accounts set current_balance = current_balance + p_amount, updated_at = now()
      where id = p_destination_account_id and user_id = p_user_id;
    end if;
  end if;

  insert into audit_logs(user_id, action, entity_type, entity_id)
  values(p_user_id, 'CREATE', 'TRANSACTION', result.id);
  return result;
end;
$$;

revoke all on function public.create_financial_transaction_service(
  uuid, text, numeric, text, uuid, uuid, uuid, text, text, timestamptz,
  text, text, text, numeric, text
) from public, anon, authenticated;
grant execute on function public.create_financial_transaction_service(
  uuid, text, numeric, text, uuid, uuid, uuid, text, text, timestamptz,
  text, text, text, numeric, text
) to service_role;

create or replace function public.delete_financial_transaction(p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tx public.transactions;
begin
  select * into tx from transactions where id = p_id and user_id = uid for update;
  if not found then return false; end if;
  if tx.status = 'CONFIRMED' and tx.account_id is not null then
    if tx.type in ('EXPENSE', 'LOAN_GIVEN', 'CREDIT_CARD_PAYMENT') then
      update accounts set current_balance = current_balance + tx.amount, updated_at = now()
      where id = tx.account_id and user_id = uid;
    elsif tx.type in ('INCOME', 'REFUND', 'LOAN_RECEIVED') then
      update accounts set current_balance = current_balance - tx.amount, updated_at = now()
      where id = tx.account_id and user_id = uid;
    elsif tx.type = 'TRANSFER' then
      update accounts set current_balance = current_balance + tx.amount, updated_at = now()
      where id = tx.account_id and user_id = uid;
      update accounts set current_balance = current_balance - tx.amount, updated_at = now()
      where id = tx.destination_account_id and user_id = uid;
    end if;
  end if;
  delete from transactions where id = p_id and user_id = uid;
  insert into audit_logs(user_id, action, entity_type, entity_id)
  values(uid, 'DELETE', 'TRANSACTION', p_id);
  return true;
end;
$$;
grant execute on function public.delete_financial_transaction(uuid) to authenticated;
