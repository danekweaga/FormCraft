-- Reports: persisted, inspectable content intelligence with read-only agent access.

alter table if exists public.ai_model_preferences
  drop constraint if exists ai_model_preferences_task_type_check;
alter table if exists public.ai_model_preferences
  add constraint ai_model_preferences_task_type_check check (
    task_type in (
      'content_analysis', 'idea_evaluation', 'idea_generation',
      'script_generation', 'roadmap_review', 'experiment_analysis',
      'audience_analysis', 'performance_review', 'pre_publish_review',
      'editing_guidance', 'today_recommendation', 'content_classification',
      'lesson_generation', 'weekly_review', 'research_analysis',
      'content_remix', 'report_synthesis'
    )
  );

create table if not exists public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_type text not null check (report_type in (
    'content_strategy_audit',
    'weekly_content_review',
    'audience_demand_report',
    'signal_finder_report',
    'hook_report',
    'format_report',
    'experiment_report',
    'content_pillar_report',
    'roadmap_progress_report',
    'winner_breakdown_report',
    'underperformance_review',
    'monthly_growth_review'
  )),
  name text not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_type)
);

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_definition_id uuid not null references public.report_definitions (id) on delete cascade,
  frequency text not null default 'manual' check (frequency in ('manual', 'daily', 'weekly', 'monthly')),
  timezone text not null default 'UTC',
  schedule_config jsonb not null default '{}'::jsonb,
  delivery_preferences jsonb not null default '{"summary":true,"top_insights":true,"recommended_actions":true}'::jsonb,
  email_enabled boolean not null default false,
  enabled boolean not null default false,
  last_run_at timestamptz,
  next_run_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_definition_id)
);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_definition_id uuid not null references public.report_definitions (id) on delete cascade,
  report_type text not null,
  status text not null default 'queued' check (status in (
    'queued', 'collecting_data', 'calculating', 'analyzing', 'ready', 'partial', 'failed'
  )),
  progress jsonb not null default '{"step":"queued","completed":0,"total":5}'::jsonb,
  period_start timestamptz,
  period_end timestamptz,
  data_window jsonb not null default '{}'::jsonb,
  data_snapshot jsonb not null default '{}'::jsonb,
  data_snapshot_hash text,
  result jsonb not null default '{}'::jsonb,
  source_ids jsonb not null default '{}'::jsonb,
  metrics_used text[] not null default '{}',
  model text,
  prompt_version text,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  error_code text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists report_runs_user_created_idx
  on public.report_runs (user_id, created_at desc);
create index if not exists report_runs_definition_created_idx
  on public.report_runs (report_definition_id, created_at desc);
create index if not exists report_schedules_due_idx
  on public.report_schedules (enabled, next_run_at)
  where enabled = true;

create table if not exists public.report_run_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_run_id uuid not null references public.report_runs (id) on delete cascade,
  finding_id text not null,
  direction text not null default 'supporting' check (direction in ('supporting', 'contradictory', 'context')),
  source_type text not null,
  source_id text not null,
  label text not null,
  excerpt text,
  metrics jsonb not null default '{}'::jsonb,
  href text,
  created_at timestamptz not null default now(),
  unique (report_run_id, finding_id, direction, source_type, source_id)
);

create index if not exists report_run_evidence_run_idx
  on public.report_run_evidence (report_run_id, finding_id);

create table if not exists public.report_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'AI agent',
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default '{reports:read}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists report_access_tokens_user_idx
  on public.report_access_tokens (user_id, created_at desc);

create trigger report_definitions_updated_at
  before update on public.report_definitions
  for each row execute function public.handle_updated_at();
create trigger report_schedules_updated_at
  before update on public.report_schedules
  for each row execute function public.handle_updated_at();

alter table public.report_definitions enable row level security;
alter table public.report_schedules enable row level security;
alter table public.report_runs enable row level security;
alter table public.report_run_evidence enable row level security;
alter table public.report_access_tokens enable row level security;

create policy "report_definitions_all_own" on public.report_definitions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "report_schedules_all_own" on public.report_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "report_runs_all_own" on public.report_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "report_run_evidence_all_own" on public.report_run_evidence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "report_access_tokens_all_own" on public.report_access_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.report_access_tokens is
  'Stores only SHA-256 hashes of scoped read-only report tokens. Plain tokens are shown once and never persisted.';
