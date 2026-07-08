-- =============================================================================
-- TruckDash + Cluckin Chaos · Supabase Storage buckets
-- Run in Supabase Dashboard → SQL Editor
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
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) RLS on storage.objects
-- Public read (required for Cluckin Chaos + CDN)
drop policy if exists "Public read menu-data" on storage.objects;
create policy "Public read menu-data"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-data');

drop policy if exists "Public read menu-images" on storage.objects;
create policy "Public read menu-images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-images');

-- Authenticated owners: insert / update / delete (delete needed for overwrite on re-publish)
drop policy if exists "Owners insert menu-data" on storage.objects;
create policy "Owners insert menu-data"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'menu-data');

drop policy if exists "Owners update menu-data" on storage.objects;
create policy "Owners update menu-data"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'menu-data')
  with check (bucket_id = 'menu-data');

drop policy if exists "Owners delete menu-data" on storage.objects;
create policy "Owners delete menu-data"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'menu-data');

drop policy if exists "Owners insert menu-images" on storage.objects;
create policy "Owners insert menu-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'menu-images');

drop policy if exists "Owners update menu-images" on storage.objects;
create policy "Owners update menu-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

drop policy if exists "Owners delete menu-images" on storage.objects;
create policy "Owners delete menu-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'menu-images');