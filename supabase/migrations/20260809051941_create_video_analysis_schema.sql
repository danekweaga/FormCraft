-- Video Breakdown Lab
create type public.analysis_mode as enum (
  'quick',
  'deep',
  'expert'
);

create type public.analysis_subject_type as enum (
  'own_content',
  'competitor_reference',
  'viral_outlier',
  'draft',
  'unpublished',
  'unknown'
);

create type public.analysis_input_type as enum (
  'video_upload',
  'audio_upload',
  'social_url',
  'youtube_url',
  'tiktok_url',
  'instagram_url',
  'transcript_paste',
  'transcript_file',
  'formcraft_source',
  'my_content_post'
);

create type public.analysis_status as enum (
  'queued',
  'processing',
  'ready',
  'failed'
);

create table public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  subject_type public.analysis_subject_type not null default 'unknown',
  input_type public.analysis_input_type not null,
  analysis_mode public.analysis_mode not null default 'deep',
  status public.analysis_status not null default 'queued',
  source_url text,
  storage_path text,
  transcript text,
  transcript_hash text,
  media_hash text,
  content_post_id uuid references public.content_posts (id) on delete set null,
  parent_analysis_id uuid references public.video_analyses (id) on delete set null,
  has_visual_evidence boolean not null default false,
  has_audio_evidence boolean not null default false,
  model_name text,
  prompt_version text not null default 'v1',
  knowledge_sources jsonb not null default '[]'::jsonb,
  result jsonb,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_analyses_user_created_idx
  on public.video_analyses (user_id, created_at desc);
create index video_analyses_transcript_hash_idx
  on public.video_analyses (user_id, transcript_hash, analysis_mode);

create table public.saved_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  pattern_type text not null,
  content jsonb not null default '{}'::jsonb,
  source_analysis_id uuid references public.video_analyses (id) on delete set null,
  source_post_id uuid references public.content_posts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger video_analyses_updated_at
  before update on public.video_analyses
  for each row execute function public.handle_updated_at();

create trigger saved_patterns_updated_at
  before update on public.saved_patterns
  for each row execute function public.handle_updated_at();

alter table public.video_analyses enable row level security;
alter table public.saved_patterns enable row level security;

create policy "video_analyses_all_own" on public.video_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_patterns_all_own" on public.saved_patterns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('analysis-media', 'analysis-media', false, 104857600)
on conflict (id) do nothing;

create policy "analysis_media_select_own"
  on storage.objects for select
  using (bucket_id = 'analysis-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "analysis_media_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'analysis-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "analysis_media_update_own"
  on storage.objects for update
  using (bucket_id = 'analysis-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'analysis-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "analysis_media_delete_own"
  on storage.objects for delete
  using (bucket_id = 'analysis-media' and (storage.foldername(name))[1] = auth.uid()::text);
