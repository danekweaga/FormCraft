-- Growth Phase F.5 — owned social connections, sync jobs, metric snapshots
-- Tokens live in social_oauth_credentials (no RLS policies → only service_role)

create type public.social_platform as enum (
  'instagram',
  'youtube',
  'tiktok',
  'linkedin',
  'x',
  'threads'
);

create type public.social_connection_status as enum (
  'connected',
  'not_connected',
  'needs_attention',
  'syncing',
  'disconnected'
);

create type public.social_account_type as enum (
  'owned',
  'reference'
);

create type public.social_sync_type as enum (
  'initial_import',
  'incremental_sync',
  'metrics_refresh',
  'comments_refresh',
  'profile_refresh'
);

create type public.social_sync_status as enum (
  'queued',
  'running',
  'completed',
  'partial',
  'failed'
);

create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform public.social_platform not null,
  platform_account_id text not null,
  username text,
  display_name text,
  avatar_url text,
  account_type public.social_account_type not null default 'owned',
  status public.social_connection_status not null default 'connected',
  granted_scopes text[] not null default '{}',
  access_token_reference text,
  refresh_token_reference text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_successful_sync_at timestamptz,
  next_scheduled_sync_at timestamptz,
  last_error text,
  auto_sync_enabled boolean not null default true,
  sync_frequency_hours integer not null default 24
    check (sync_frequency_hours between 1 and 168),
  import_comments boolean not null default true,
  import_older_posts boolean not null default false,
  use_for_ai boolean not null default true,
  use_for_roadmap boolean not null default true,
  use_for_experiments boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_connections_owned_or_reference check (
    account_type in ('owned', 'reference')
  )
);

-- One owned connection per platform account per user
create unique index social_connections_user_platform_account_uidx
  on public.social_connections (user_id, platform, platform_account_id)
  where account_type = 'owned' and status <> 'disconnected';

create index social_connections_user_platform_idx
  on public.social_connections (user_id, platform, status);

create table public.social_oauth_credentials (
  connection_id uuid primary key
    references public.social_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  provider_token_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.social_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  social_connection_id uuid not null
    references public.social_connections (id) on delete cascade,
  sync_type public.social_sync_type not null,
  status public.social_sync_status not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  records_found integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  error_code text,
  error_message text,
  progress jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index social_sync_jobs_connection_created_idx
  on public.social_sync_jobs (social_connection_id, created_at desc);
create index social_sync_jobs_user_status_idx
  on public.social_sync_jobs (user_id, status);

-- Extend content_posts for synced ownership + freshness
alter table public.content_posts
  add column if not exists social_connection_id uuid
    references public.social_connections (id) on delete set null,
  add column if not exists metrics_refreshed_at timestamptz,
  add column if not exists thumbnail_url text;

create unique index if not exists content_posts_user_platform_external_uidx
  on public.content_posts (user_id, platform, external_id)
  where external_id is not null;

create index if not exists content_posts_connection_idx
  on public.content_posts (social_connection_id)
  where social_connection_id is not null;

create table public.content_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_post_id uuid not null
    references public.content_posts (id) on delete cascade,
  social_connection_id uuid
    references public.social_connections (id) on delete set null,
  social_sync_job_id uuid
    references public.social_sync_jobs (id) on delete set null,
  captured_at timestamptz not null default now(),
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
  extra_metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index content_metric_snapshots_post_captured_idx
  on public.content_metric_snapshots (content_post_id, captured_at desc);
create index content_metric_snapshots_user_captured_idx
  on public.content_metric_snapshots (user_id, captured_at desc);

create trigger social_connections_updated_at
  before update on public.social_connections
  for each row execute function public.handle_updated_at();

create trigger social_oauth_credentials_updated_at
  before update on public.social_oauth_credentials
  for each row execute function public.handle_updated_at();

alter table public.social_connections enable row level security;
alter table public.social_oauth_credentials enable row level security;
alter table public.social_sync_jobs enable row level security;
alter table public.content_metric_snapshots enable row level security;

-- Connections + jobs + snapshots: owner access
create policy "social_connections_all_own" on public.social_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "social_sync_jobs_all_own" on public.social_sync_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "content_metric_snapshots_all_own" on public.content_metric_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Credentials: RLS on, zero policies for anon/authenticated.
-- service_role bypasses RLS for server-side token read/write only.
comment on table public.social_oauth_credentials is
  'Encrypted OAuth tokens. No client policies; access only via service role.';
