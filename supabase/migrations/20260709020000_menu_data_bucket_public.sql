-- Ensure menu-data + menu-images buckets exist and are PUBLIC so Cluckin Chaos
-- can fetch https://.../storage/v1/object/public/menu-data/cluckin-chaos/menu.json

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'menu-data',
    'menu-data',
    true,
    5242880,
    array['application/json', 'application/octet-stream', 'text/plain']
  ),
  (
    'menu-images',
    'menu-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
  )
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set public = true
where id in ('menu-data', 'menu-images');

-- Public read (Cluckin Chaos + CDN)
drop policy if exists menu_data_public_read on storage.objects;
create policy menu_data_public_read on storage.objects for select
  to anon, authenticated using (bucket_id = 'menu-data');

drop policy if exists menu_images_public_read on storage.objects;
create policy menu_images_public_read on storage.objects for select
  to anon, authenticated using (bucket_id = 'menu-images');

-- Anon write so Publish works without owner sign-in
drop policy if exists menu_data_anon_insert on storage.objects;
create policy menu_data_anon_insert on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'menu-data');

drop policy if exists menu_data_anon_update on storage.objects;
create policy menu_data_anon_update on storage.objects for update
  to anon, authenticated using (bucket_id = 'menu-data') with check (bucket_id = 'menu-data');

drop policy if exists menu_data_anon_delete on storage.objects;
create policy menu_data_anon_delete on storage.objects for delete
  to anon, authenticated using (bucket_id = 'menu-data');

drop policy if exists menu_images_anon_insert on storage.objects;
create policy menu_images_anon_insert on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'menu-images');

drop policy if exists menu_images_anon_update on storage.objects;
create policy menu_images_anon_update on storage.objects for update
  to anon, authenticated using (bucket_id = 'menu-images') with check (bucket_id = 'menu-images');

drop policy if exists menu_images_anon_delete on storage.objects;
create policy menu_images_anon_delete on storage.objects for delete
  to anon, authenticated using (bucket_id = 'menu-images');
