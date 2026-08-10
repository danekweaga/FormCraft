-- Growth K: private audio storage for global Canvas voice-note capture.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'canvas-media',
  'canvas-media',
  false,
  900000,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
)
on conflict (id) do nothing;

create policy "canvas_media_select_own"
  on storage.objects for select
  using (bucket_id = 'canvas-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "canvas_media_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'canvas-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "canvas_media_update_own"
  on storage.objects for update
  using (bucket_id = 'canvas-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'canvas-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "canvas_media_delete_own"
  on storage.objects for delete
  using (bucket_id = 'canvas-media' and (storage.foldername(name))[1] = auth.uid()::text);
