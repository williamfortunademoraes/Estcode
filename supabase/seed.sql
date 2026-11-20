insert into public.inventories (id, name, active)
values ('00000000-0000-0000-0000-000000000001', 'Estoque compartilhado', true)
on conflict (id) do update set name = excluded.name, active = excluded.active;

insert into public.inventory_settings (inventory_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (inventory_id) do nothing;

-- O primeiro usuário criado pelo Supabase Auth recebe role operator por padrão.
-- Promova um usuário inicial de forma explícita e auditável após o cadastro:
-- update public.profiles set role = 'admin' where id = '<AUTH_USER_UUID>';
