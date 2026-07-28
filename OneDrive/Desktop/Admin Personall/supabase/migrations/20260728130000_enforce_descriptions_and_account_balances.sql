-- A confirmed movement is an account operation, never just a history row.
-- Keep legacy rows readable while rejecting new anonymous rows.
alter table public.transactions
  drop constraint if exists transactions_require_description;

alter table public.transactions
  add constraint transactions_require_description
  check (
    nullif(btrim(coalesce(merchant, '')), '') is not null
    or nullif(btrim(coalesce(description, '')), '') is not null
    or nullif(btrim(coalesce(notes, '')), '') is not null
    or nullif(btrim(coalesce(note, '')), '') is not null
  ) not valid;

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
  if nullif(btrim(coalesce(p_merchant, '')), '') is null
     and nullif(btrim(coalesce(p_description, '')), '') is null then
    raise exception 'A transaction description is required';
  end if;
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
  if p_type = 'TRANSFER' and (p_destination_account_id is null or p_destination_account_id = p_account_id) then
    raise exception 'Invalid transfer destination';
  end if;
  if p_idempotency_key is not null then
    select * into result from transactions where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then return result; end if;
  end if;

  insert into transactions (
    user_id, type, amount, currency, account_id, destination_account_id,
    category_id, merchant, description, occurred_at, source, status,
    idempotency_key, confidence, raw_input
  ) values (
    p_user_id, p_type, p_amount, p_currency, p_account_id,
    p_destination_account_id, p_category_id, nullif(btrim(p_merchant), ''),
    nullif(btrim(p_description), ''), p_occurred_at, p_source, p_status,
    p_idempotency_key, p_confidence, p_raw_input
  ) returning * into result;

  if p_status = 'CONFIRMED' then
    if p_type in ('EXPENSE', 'LOAN_GIVEN') then
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = p_user_id;
    elsif p_type in ('INCOME', 'REFUND', 'LOAN_RECEIVED') then
      update accounts set current_balance = current_balance + p_amount, updated_at = now()
      where id = p_account_id and user_id = p_user_id;
    elsif p_type = 'TRANSFER' then
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = p_user_id;
      update accounts set current_balance = current_balance + p_amount, updated_at = now()
      where id = p_destination_account_id and user_id = p_user_id;
    elsif p_type = 'CREDIT_CARD_PAYMENT' then
      update accounts set current_balance = current_balance - p_amount, updated_at = now()
      where id = p_account_id and user_id = p_user_id;
    end if;
  end if;

  insert into audit_logs(user_id, action, entity_type, entity_id)
  values(p_user_id, 'CREATE', 'TRANSACTION', result.id);
  return result;
end;
$$;
