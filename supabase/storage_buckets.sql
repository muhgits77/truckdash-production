-- =============================================================================
-- TruckDash · Supabase Storage buckets + RLS
-- Run once: Dashboard → SQL Editor → paste → Run
--
-- Or: npm run setup  (with SUPABASE_SERVICE_ROLE_KEY in .env)
--
-- Canonical publish object:
--   menu-data/{truckId}/menu.json
--   public:
--   {SUPABASE_URL}/storage/v1/object/public/menu-data/{truckId}/menu.json
--
-- After this SQL, Publish can use the public anon key (no sign-in required).
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

update storage.buckets
set public = true
where id in ('menu-data', 'menu-images');

-- 2) Drop known policy aliases, then re-create
drop policy if exists "Public read menu-data" on storage.objects;
drop policy if exists menu_data_public_read on storage.objects;
drop policy if exists "Owners insert menu-data" on storage.objects;
drop policy if exists menu_data_anon_insert on storage.objects;
drop policy if exists "Owners update menu-data" on storage.objects;
drop policy if exists menu_data_anon_update on storage.objects;
drop policy if exists "Owners delete menu-data" on storage.objects;
drop policy if exists menu_data_anon_delete on storage.objects;
drop policy if exists menu_data_public_all on storage.objects;

drop policy if exists "Public read menu-images" on storage.objects;
drop policy if exists menu_images_public_read on storage.objects;
drop policy if exists "Owners insert menu-images" on storage.objects;
drop policy if exists menu_images_anon_insert on storage.objects;
drop policy if exists "Owners update menu-images" on storage.objects;
drop policy if exists menu_images_anon_update on storage.objects;
drop policy if exists "Owners delete menu-images" on storage.objects;
drop policy if exists menu_images_anon_delete on storage.objects;
drop policy if exists menu_images_public_all on storage.objects;

-- public role: classic anon JWT + authenticated sessions (upsert needs INSERT+UPDATE)
create policy menu_data_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'menu-data');

create policy menu_data_anon_insert
  on storage.objects for insert
  to public
  with check (bucket_id = 'menu-data');

create policy menu_data_anon_update
  on storage.objects for update
  to public
  using (bucket_id = 'menu-data')
  with check (bucket_id = 'menu-data');

create policy menu_data_anon_delete
  on storage.objects for delete
  to public
  using (bucket_id = 'menu-data');

create policy menu_images_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'menu-images');

create policy menu_images_anon_insert
  on storage.objects for insert
  to public
  with check (bucket_id = 'menu-images');

create policy menu_images_anon_update
  on storage.objects for update
  to public
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

create policy menu_images_anon_delete
  on storage.objects for delete
  to public
  using (bucket_id = 'menu-images');

-- Verify:
--   select id, name, public from storage.buckets where id in ('menu-data','menu-images');
