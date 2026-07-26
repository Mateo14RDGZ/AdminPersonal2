alter table public.financial_entries
  add column if not exists currency text not null default 'UYU';

alter table public.financial_entries
  drop constraint if exists financial_entries_currency_check;

alter table public.financial_entries
  add constraint financial_entries_currency_check
  check (currency ~ '^[A-Z]{3}$');
