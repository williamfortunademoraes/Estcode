-- History screens display the responsible user's name to every active user.
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_active_users on public.profiles for select to authenticated
  using (public.is_active_user());
