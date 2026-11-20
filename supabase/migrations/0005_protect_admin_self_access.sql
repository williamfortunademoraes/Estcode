-- Keep the last authenticated administrator from accidentally locking out the system
-- through a direct profile update or the administrative Edge Function.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_admin boolean;
begin
  -- The first administrator is promoted by a trusted SQL/bootstrap context,
  -- before an authenticated admin exists.
  if auth.uid() is null then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and active
  ) into actor_is_admin;

  if old.id <> auth.uid() and not actor_is_admin then
    raise exception 'profile_update_not_allowed' using errcode = '42501';
  end if;

  if (old.role <> new.role or old.active <> new.active)
     and not actor_is_admin then
    raise exception 'profile_admin_fields_not_allowed' using errcode = '42501';
  end if;

  if old.id = auth.uid()
     and old.role = 'admin'
     and (new.role <> 'admin' or not new.active) then
    raise exception 'admin_self_access_protection' using errcode = '42501';
  end if;

  return new;
end;
$$;
