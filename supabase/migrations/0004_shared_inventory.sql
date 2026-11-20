-- The first deployment must have the shared inventory even when seed.sql is not run.
insert into public.inventories (id, name, active)
values ('00000000-0000-0000-0000-000000000001', 'Estoque compartilhado', true)
on conflict (id) do update
set name = excluded.name,
    active = excluded.active;

insert into public.inventory_settings (inventory_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (inventory_id) do nothing;
