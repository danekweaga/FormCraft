-- Research Radar: official-API discovery and user-saved reference videos.
-- Public YouTube discovery is supported through the YouTube Data API.
-- Instagram/TikTok references are manual unless an official provider grants access.

create table if not exists public.research_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  query text not null,
  platforms text[] not null default '{youtube}',
  lookback_days integer not null default 30
    check (lookback_days between 1 and 365),
  min_views bigint not null default 0 check (min_views >= 0),
  min_outlier_score numeric not null default 1.5
    check (min_outlier_score between 0 and 1000),
  max_results integer not null default 25
    check (max_results between 5 and 50),
  auto_scan_enabled boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'paused', 'needs_attention')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_scans_user_status_idx
  on public.research_scans (user_id, status, next_run_at);

create table if not exists public.research_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  research_scan_id uuid references public.research_scans (id) on delete set null,
  platform text not null
    check (platform in ('youtube', 'instagram', 'tiktok', 'other')),
  external_id text not null,
  external_url text not null,
  creator_id text,
  creator_name text,
  title text,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds numeric,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  creator_followers bigint,
  baseline_views numeric,
  outlier_score numeric,
  score_basis text,
  hook_text text,
  topic text,
  analysis jsonb not null default '{}'::jsonb,
  analysis_model text,
  saved boolean not null default false,
  source text not null default 'official_api'
    check (source in ('official_api', 'manual_reference')),
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

create index if not exists research_items_user_score_idx
  on public.research_items (user_id, outlier_score desc nulls last, discovered_at desc);
create index if not exists research_items_scan_idx
  on public.research_items (research_scan_id, discovered_at desc);
create index if not exists research_items_saved_idx
  on public.research_items (user_id, saved, updated_at desc);

create trigger research_scans_updated_at
  before update on public.research_scans
  for each row execute function public.handle_updated_at();

create trigger research_items_updated_at
  before update on public.research_items
  for each row execute function public.handle_updated_at();

alter table public.research_scans enable row level security;
alter table public.research_items enable row level security;

create policy "research_scans_all_own" on public.research_scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "research_items_all_own" on public.research_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

