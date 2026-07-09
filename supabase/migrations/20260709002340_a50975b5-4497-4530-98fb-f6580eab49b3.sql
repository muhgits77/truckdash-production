
drop policy if exists menu_data_public_read on storage.objects;
drop policy if exists menu_data_anon_insert on storage.objects;
drop policy if exists menu_data_anon_update on storage.objects;
drop policy if exists menu_data_anon_delete on storage.objects;
drop policy if exists menu_images_public_read on storage.objects;
drop policy if exists menu_images_anon_insert on storage.objects;
drop policy if exists menu_images_anon_update on storage.objects;
drop policy if exists menu_images_anon_delete on storage.objects;

create policy menu_data_public_read on storage.objects for select
  to anon, authenticated using (bucket_id = 'menu-data');
create policy menu_data_anon_insert on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'menu-data');
create policy menu_data_anon_update on storage.objects for update
  to anon, authenticated using (bucket_id = 'menu-data') with check (bucket_id = 'menu-data');
create policy menu_data_anon_delete on storage.objects for delete
  to anon, authenticated using (bucket_id = 'menu-data');

create policy menu_images_public_read on storage.objects for select
  to anon, authenticated using (bucket_id = 'menu-images');
create policy menu_images_anon_insert on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'menu-images');
create policy menu_images_anon_update on storage.objects for update
  to anon, authenticated using (bucket_id = 'menu-images') with check (bucket_id = 'menu-images');
create policy menu_images_anon_delete on storage.objects for delete
  to anon, authenticated using (bucket_id = 'menu-images');
