-- My Content: personal published-content intelligence
create type public.content_platform as enum (
  'instagram',
  'tiktok',
  'youtube_shorts',
  'youtube',
  'linkedin',
  'x',
  'threads',
  'other'
);

create type public.content_source as enum (
  'connected_account',
  'csv_import',
  'manual_entry',
  'post_url',
  'video_upload',
  'transcript_upload',
  'formcraft_draft',
  'formcraft_published'
);

create type public.lesson_status as enum (
  'suggested',
  'confirmed',
  'rejected',
  'expired'
);

create type public.experiment_status as enum (
  'planned',
  'running',
  'completed',
  'abandoned'
);

create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform public.content_platform not null default 'other',
  source public.content_source not null default 'manual_entry',
  source_label text not null default 'Manual entry',
  external_url text,
  external_id text,
  title text,
  caption text,
  transcript text,
  hook_text text,
  topic text,
  content_pillar text,
  format text,
  duration_seconds numeric,
  cta text,
  story_structure text,
  thumbnail_path text,
  media_path text,
  published_at timestamptz,
  -- Metrics: null means unavailable — never fabricate
  views bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  followers_gained integer,
  watch_time_seconds numeric,
  average_view_duration_seconds numeric,
  completion_rate numeric,
  profile_visits bigint,
  link_clicks bigint,
  classification jsonb not null default '{}'::jsonb,
  creative_attributes jsonb not null default '{}'::jsonb,
  relative_performance jsonb not null default '{}'::jsonb,
  cluster_id uuid,
  is_winner boolean not null default false,
  needs_review boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_posts_user_published_idx
  on public.content_posts (user_id, published_at desc nulls last);
create index content_posts_user_platform_idx
  on public.content_posts (user_id, platform);
create index content_posts_search_idx
  on public.content_posts using gin (search_vector);

create table public.content_clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index content_clusters_user_name_uidx
  on public.content_clusters (user_id, lower(name));

alter table public.content_posts
  add constraint content_posts_cluster_fk
  foreign key (cluster_id) references public.content_clusters (id) on delete set null;

create table public.performance_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson text not null,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric,
  sample_size integer,
  status public.lesson_status not null default 'suggested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index performance_lessons_user_status_idx
  on public.performance_lessons (user_id, status);

create table public.content_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hypothesis text not null,
  test_plan text,
  status public.experiment_status not null default 'planned',
  post_ids uuid[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  result text,
  conclusion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create or replace function public.content_posts_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.caption, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.transcript, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.topic, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.hook_text, '')), 'B');
  new.updated_at := now();
  return new;
end;
$$;

create trigger content_posts_search_vector
  before insert or update of title, caption, transcript, topic, hook_text
  on public.content_posts
  for each row execute function public.content_posts_search_vector_update();

create trigger content_clusters_updated_at
  before update on public.content_clusters
  for each row execute function public.handle_updated_at();

create trigger performance_lessons_updated_at
  before update on public.performance_lessons
  for each row execute function public.handle_updated_at();

create trigger content_experiments_updated_at
  before update on public.content_experiments
  for each row execute function public.handle_updated_at();

alter table public.content_posts enable row level security;
alter table public.content_clusters enable row level security;
alter table public.performance_lessons enable row level security;
alter table public.content_experiments enable row level security;
alter table public.content_weekly_reports enable row level security;

create policy "content_posts_all_own" on public.content_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "content_clusters_all_own" on public.content_clusters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "performance_lessons_all_own" on public.performance_lessons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "content_experiments_all_own" on public.content_experiments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "content_weekly_reports_all_own" on public.content_weekly_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('content-media', 'content-media', false, 104857600)
on conflict (id) do nothing;

create policy "content_media_select_own"
  on storage.objects for select
  using (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "content_media_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "content_media_update_own"
  on storage.objects for update
  using (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "content_media_delete_own"
  on storage.objects for delete
  using (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);
