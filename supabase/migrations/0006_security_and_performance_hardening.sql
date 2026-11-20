-- Harden the remaining exposed function and policy metadata reported by Supabase advisors.
alter function public.movement_result(public.stock_movements, boolean)
  set search_path = public;

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_role(array['admin']::public.user_role[])))
  with check (id = (select auth.uid()) or (select public.has_role(array['admin']::public.user_role[])));

create index if not exists audit_logs_user_created_idx
  on public.audit_logs (user_id, created_at desc);

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
