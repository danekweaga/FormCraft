-- Growth G1.5 — AI jobs, cache, budget-friendly usage columns

create type public.ai_job_status as enum (
  'queued',
  'processing',
  'completed',
  'failed',
  'rate_limited',
  'budget_blocked'
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_type text not null,
  provider text not null default 'openrouter',
  model text,
  status public.ai_job_status not null default 'queued',
  prompt_version text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  actual_cost numeric(12, 6),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  cached boolean not null default false,
  input_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_jobs_user_created_idx
  on public.ai_jobs (user_id, created_at desc);
create index if not exists ai_jobs_user_hash_idx
  on public.ai_jobs (user_id, job_type, input_hash)
  where input_hash is not null;

-- Cached structured AI results (no secrets / no OAuth tokens)
create table if not exists public.ai_result_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cache_key text not null,
  job_type text not null,
  prompt_version text not null,
  model text,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, cache_key)
);

create index if not exists ai_result_cache_user_job_idx
  on public.ai_result_cache (user_id, job_type, created_at desc);

-- Expand usage event columns for provider/cost tracking
alter table public.ai_usage_events
  add column if not exists provider text not null default 'openrouter',
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists cost_usd numeric(12, 6);

-- Allow multimodal tier on usage events
alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_model_tier_check;
alter table public.ai_usage_events
  add constraint ai_usage_events_model_tier_check
  check (model_tier in ('cheap', 'standard', 'premium', 'multimodal'));

alter table public.ai_jobs enable row level security;
alter table public.ai_result_cache enable row level security;

create policy "ai_jobs_all_own" on public.ai_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_result_cache_all_own" on public.ai_result_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
