-- Growth H: Niche intelligence — creators, watchlists, snapshots, feedback, niche profile

create table if not exists public.external_creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in ('youtube', 'instagram', 'tiktok', 'other')),
  platform_creator_id text not null,
  handle text,
  display_name text,
  profile_url text,
  avatar_url text,
  follower_count bigint,
  niche text,
  data_source text not null default 'official_api',
  data_freshness_at timestamptz,
  notes text,
  tracking_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, platform_creator_id)
);

create index if not exists external_creators_user_platform_idx
  on public.external_creators (user_id, platform);

create table if not exists public.research_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.research_watchlist_members (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.research_watchlists (id) on delete cascade,
  external_creator_id uuid not null references public.external_creators (id) on delete cascade,
  priority integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (watchlist_id, external_creator_id)
);

create index if not exists research_watchlist_members_creator_idx
  on public.research_watchlist_members (external_creator_id);

create table if not exists public.external_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  research_item_id uuid not null references public.research_items (id) on delete cascade,
  captured_at timestamptz not null default now(),
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  follower_count bigint,
  data_source text not null default 'official_api'
);

create index if not exists external_metric_snapshots_item_idx
  on public.external_metric_snapshots (research_item_id, captured_at desc);

create table if not exists public.provider_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  operation text not null,
  result_count integer not null default 0,
  cost_usd numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists provider_usage_events_user_created_idx
  on public.provider_usage_events (user_id, created_at desc);

create table if not exists public.research_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  research_item_id uuid references public.research_items (id) on delete cascade,
  external_creator_id uuid references public.external_creators (id) on delete set null,
  feedback_type text not null
    check (feedback_type in (
      'relevant',
      'not_relevant',
      'already_covered',
      'wrong_audience',
      'wrong_niche',
      'save_for_later',
      'hide_creator'
    )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.niche_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  main_niche text,
  secondary_niches text[] not null default '{}',
  topics text[] not null default '{}',
  keywords text[] not null default '{}',
  excluded_topics text[] not null default '{}',
  target_audience text,
  platforms text[] not null default '{youtube}',
  languages text[] not null default '{en}',
  reference_creator_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend research_items for Growth H fields
alter table public.research_items
  add column if not exists external_creator_id uuid
    references public.external_creators (id) on delete set null;
alter table public.research_items
  add column if not exists outlier_label text;
alter table public.research_items
  add column if not exists baseline_confidence text
    check (baseline_confidence is null or baseline_confidence in ('low', 'medium', 'high'));
alter table public.research_items
  add column if not exists baseline_sample_size integer;
alter table public.research_items
  add column if not exists data_freshness_at timestamptz;
alter table public.research_items
  add column if not exists velocity_label text
    check (velocity_label is null or velocity_label in ('accelerating', 'stable', 'slowing', 'emerging', 'confirmed', 'cooling'));
alter table public.research_items
  add column if not exists personal_relevance_score numeric;
alter table public.research_items
  add column if not exists hidden boolean not null default false;
alter table public.research_items
  add column if not exists collection_method text not null default 'search';

create trigger external_creators_updated_at
  before update on public.external_creators
  for each row execute function public.handle_updated_at();

create trigger research_watchlists_updated_at
  before update on public.research_watchlists
  for each row execute function public.handle_updated_at();

create trigger niche_profiles_updated_at
  before update on public.niche_profiles
  for each row execute function public.handle_updated_at();

alter table public.external_creators enable row level security;
alter table public.research_watchlists enable row level security;
alter table public.research_watchlist_members enable row level security;
alter table public.external_metric_snapshots enable row level security;
alter table public.provider_usage_events enable row level security;
alter table public.research_feedback enable row level security;
alter table public.niche_profiles enable row level security;

create policy "external_creators_all_own" on public.external_creators
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "research_watchlists_all_own" on public.research_watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "research_watchlist_members_all_own" on public.research_watchlist_members
  for all using (
    exists (
      select 1 from public.research_watchlists w
      where w.id = watchlist_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.research_watchlists w
      where w.id = watchlist_id and w.user_id = auth.uid()
    )
  );
create policy "external_metric_snapshots_all_own" on public.external_metric_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "provider_usage_events_all_own" on public.provider_usage_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "research_feedback_all_own" on public.research_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "niche_profiles_all_own" on public.niche_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
