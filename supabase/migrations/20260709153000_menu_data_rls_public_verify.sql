-- =============================================================================
-- Ensure menu-data is PUBLIC and fully readable/writable for Publish + Cluckin
-- Chaos. Target object: menu-data/cluckin-chaos/menu.json
--
-- Post-upload the app runs storage.list('cluckin-chaos') and requires menu.json
-- to appear — SELECT RLS must allow anon + authenticated.
-- =============================================================================

-- 1) Buckets exist and are PUBLIC (anonymous /object/public/... reads)
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

-- 2) Drop ALL known policy aliases so we re-create cleanly
drop policy if exists "Public read menu-data" on storage.objects;
drop policy if exists menu_data_public_read on storage.objects;
drop policy if exists "Owners insert menu-data" on storage.objects;
drop policy if exists menu_data_anon_insert on storage.objects;
drop policy if exists "Owners update menu-data" on storage.objects;
drop policy if exists menu_data_anon_update on storage.objects;
drop policy if exists "Owners delete menu-data" on storage.objects;
drop policy if exists menu_data_anon_delete on storage.objects;

drop policy if exists "Public read menu-images" on storage.objects;
drop policy if exists menu_images_public_read on storage.objects;
drop policy if exists "Owners insert menu-images" on storage.objects;
drop policy if exists menu_images_anon_insert on storage.objects;
drop policy if exists "Owners update menu-images" on storage.objects;
drop policy if exists menu_images_anon_update on storage.objects;
drop policy if exists "Owners delete menu-images" on storage.objects;
drop policy if exists menu_images_anon_delete on storage.objects;

-- 3) menu-data: public read (list + download + /object/public/...) + anon write
--    SELECT is required for storage.list() verification after Publish
create policy menu_data_public_read
  on storage.objects for select
  to anon, authenticated, service_role
  using (bucket_id = 'menu-data');

create policy menu_data_anon_insert
  on storage.objects for insert
  to anon, authenticated, service_role
  with check (bucket_id = 'menu-data');

create policy menu_data_anon_update
  on storage.objects for update
  to anon, authenticated, service_role
  using (bucket_id = 'menu-data')
  with check (bucket_id = 'menu-data');

create policy menu_data_anon_delete
  on storage.objects for delete
  to anon, authenticated, service_role
  using (bucket_id = 'menu-data');

-- 4) menu-images (same pattern)
create policy menu_images_public_read
  on storage.objects for select
  to anon, authenticated, service_role
  using (bucket_id = 'menu-images');

create policy menu_images_anon_insert
  on storage.objects for insert
  to anon, authenticated, service_role
  with check (bucket_id = 'menu-images');

create policy menu_images_anon_update
  on storage.objects for update
  to anon, authenticated, service_role
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

create policy menu_images_anon_delete
  on storage.objects for delete
  to anon, authenticated, service_role
  using (bucket_id = 'menu-images');
