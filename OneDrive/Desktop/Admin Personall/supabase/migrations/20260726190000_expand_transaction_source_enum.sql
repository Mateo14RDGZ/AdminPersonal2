-- Additive compatibility upgrade for databases created from the first schema.
do $$
declare
  source_value text;
begin
  foreach source_value in array array[
    'text', 'voice', 'siri', 'import', 'receipt', 'recurring', 'system'
  ] loop
    execute format(
      'alter type public.transaction_source add value if not exists %L',
      source_value
    );
  end loop;
exception when undefined_object then
  null;
end $$;
