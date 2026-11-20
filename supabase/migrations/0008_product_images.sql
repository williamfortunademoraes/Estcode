alter table public.products
  add column image_path text,
  add constraint products_image_path_format check (
    image_path is null or image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]{1,64}$'
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_active_user_read
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_active_user());

create policy product_images_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.has_role(array['admin']::public.user_role[])
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  );

create policy product_images_admin_update
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_role(array['admin']::public.user_role[]))
  with check (bucket_id = 'product-images' and public.has_role(array['admin']::public.user_role[]));

create policy product_images_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_role(array['admin']::public.user_role[]));
