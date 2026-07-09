-- =============================================================================
-- TruckDash + Cluckin Chaos · Supabase Storage buckets
-- Run in Supabase Dashboard → SQL Editor (or let Lovable migrations apply)
--
-- Result:
--   menu-data/cluckin-chaos/menu.json   ← full menu + schedule (public read)
--   menu-images/{truckId}/*             ← food photos (public read)
--
-- Lovable Cloud note:
--   Public buckets may be blocked by default. Workspace owner/admin must open
--   Settings → Privacy & security and turn OFF “Block public storage buckets”
--   or public URLs will return 400 even after this SQL succeeds.
-- =============================================================================

-- 1) Buckets (public = anonymous read via /storage/v1/object/public/...)
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

-- Force public even if buckets already existed with public=false
update storage.buckets
set public = true
where id in ('menu-data', 'menu-images');

-- 2) RLS on storage.objects
-- Public read (required for Cluckin Chaos public URL + CDN)
drop policy if exists "Public read menu-data" on storage.objects;
drop policy if exists menu_data_public_read on storage.objects;
create policy menu_data_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-data');

drop policy if exists "Public read menu-images" on storage.objects;
drop policy if exists menu_images_public_read on storage.objects;
create policy menu_images_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-images');

-- Anon + authenticated write (Publish works without owner sign-in)
drop policy if exists "Owners insert menu-data" on storage.objects;
drop policy if exists menu_data_anon_insert on storage.objects;
create policy menu_data_anon_insert
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'menu-data');

drop policy if exists "Owners update menu-data" on storage.objects;
drop policy if exists menu_data_anon_update on storage.objects;
create policy menu_data_anon_update
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'menu-data')
  with check (bucket_id = 'menu-data');

drop policy if exists "Owners delete menu-data" on storage.objects;
drop policy if exists menu_data_anon_delete on storage.objects;
create policy menu_data_anon_delete
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'menu-data');

drop policy if exists "Owners insert menu-images" on storage.objects;
drop policy if exists menu_images_anon_insert on storage.objects;
create policy menu_images_anon_insert
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'menu-images');

drop policy if exists "Owners update menu-images" on storage.objects;
drop policy if exists menu_images_anon_update on storage.objects;
create policy menu_images_anon_update
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

drop policy if exists "Owners delete menu-images" on storage.objects;
drop policy if exists menu_images_anon_delete on storage.objects;
create policy menu_images_anon_delete
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'menu-images');
