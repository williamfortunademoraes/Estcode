-- Realtime is used only to refresh confirmed balances and movement history.
do $$
begin
  alter publication supabase_realtime add table public.stock_balances;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.stock_movements;
exception
  when duplicate_object then null;
end;
$$;
