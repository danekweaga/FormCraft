-- Account-level metric history (followers / views / reach over time).
-- Instagram accountInsights on social_connections.metadata is overwritten each sync;
-- this table appends so Performance graphs can show real day-over-day gains.

create table if not exists public.account_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  social_connection_id uuid not null
    references public.social_connections (id) on delete cascade,
  captured_at timestamptz not null default now(),
  day_key date not null,
  follower_count integer,
  views bigint,
  reach bigint,
  follows integer,
  unfollows integer,
  source text not null default 'sync',
  created_at timestamptz not null default now(),
  unique (social_connection_id, day_key, source)
);

create index if not exists account_metric_snapshots_user_day_idx
  on public.account_metric_snapshots (user_id, day_key desc);

create index if not exists account_metric_snapshots_connection_day_idx
  on public.account_metric_snapshots (social_connection_id, day_key desc);

alter table public.account_metric_snapshots enable row level security;

create policy "Users can read own account metric snapshots"
  on public.account_metric_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own account metric snapshots"
  on public.account_metric_snapshots
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own account metric snapshots"
  on public.account_metric_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own account metric snapshots"
  on public.account_metric_snapshots
  for delete
  using (auth.uid() = user_id);
