insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-thumbnails',
  'research-thumbnails',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public research thumbnails are readable" on storage.objects;
create policy "Public research thumbnails are readable"
  on storage.objects for select
  using (bucket_id = 'research-thumbnails');

drop policy if exists "Users upload their research thumbnails" on storage.objects;
create policy "Users upload their research thumbnails"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'research-thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their research thumbnails" on storage.objects;
create policy "Users update their research thumbnails"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'research-thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'research-thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their research thumbnails" on storage.objects;
create policy "Users delete their research thumbnails"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'research-thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
