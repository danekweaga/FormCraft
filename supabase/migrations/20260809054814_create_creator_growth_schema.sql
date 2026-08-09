-- Creator Growth & Intelligence expansion foundations
-- Personal-user first, RLS on every table. No social/LLM integrations.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.roadmap_status as enum (
  'active',
  'paused',
  'completed',
  'archived'
);

create type public.milestone_status as enum (
  'not_started',
  'in_progress',
  'done',
  'blocked',
  'skipped'
);

create type public.milestone_source_kind as enum (
  'auto',
  'manual',
  'ai_suggested'
);

create type public.idea_gate_recommendation as enum (
  'pursue',
  'reshape',
  'park',
  'kill'
);

create type public.idea_gate_status as enum (
  'draft',
  'evaluated',
  'accepted',
  'rejected',
  'archived'
);

create type public.pre_publish_status as enum (
  'draft',
  'reviewed',
  'approved',
  'needs_revision',
  'archived'
);

create type public.audience_comment_source as enum (
  'manual_paste',
  'csv_import',
  'connected_account',
  'other'
);

create type public.audience_cluster_type as enum (
  'pain',
  'desire',
  'objection',
  'language',
  'question',
  'praise',
  'other'
);

create type public.audience_language_category as enum (
  'phrase',
  'hook',
  'objection',
  'identity',
  'jargon',
  'other'
);

-- Extend experiment status for full Experiment Lab states (additive values only)
alter type public.experiment_status add value if not exists 'draft';
alter type public.experiment_status add value if not exists 'concluded';

create type public.experiment_conclusion_state as enum (
  'inconclusive',
  'validated',
  'invalidated',
  'needs_more_data'
);

-- ---------------------------------------------------------------------------
-- Expand content_experiments (additive columns only)
-- ---------------------------------------------------------------------------

alter table public.content_experiments
  add column if not exists primary_variable text,
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists control_variables jsonb not null default '{}'::jsonb,
  add column if not exists primary_metric text,
  add column if not exists secondary_metrics jsonb not null default '[]'::jsonb,
  add column if not exists target_sample_per_variant integer,
  add column if not exists observations text,
  add column if not exists conclusion_state public.experiment_conclusion_state;

comment on column public.content_experiments.hypothesis is
  'Existing hypothesis field; Experiment Lab primary statement.';
comment on column public.content_experiments.variants is
  'Array of variant descriptors for the experiment lab.';
comment on column public.content_experiments.conclusion_state is
  'Structured conclusion; free-text conclusion remains in conclusion.';

-- ---------------------------------------------------------------------------
-- Roadmap
-- ---------------------------------------------------------------------------

create table public.creator_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal text not null,
  current_phase text not null default 'foundation',
  progress_pct numeric(5, 2) not null default 0
    check (progress_pct >= 0 and progress_pct <= 100),
  status public.roadmap_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_roadmaps_user_status_idx
  on public.creator_roadmaps (user_id, status);

create table public.roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.creator_roadmaps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null default 'general',
  status public.milestone_status not null default 'not_started',
  target_value numeric,
  current_value numeric,
  source_kind public.milestone_source_kind not null default 'manual',
  evidence jsonb not null default '{}'::jsonb,
  notes text,
  deadline date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index roadmap_milestones_roadmap_sort_idx
  on public.roadmap_milestones (roadmap_id, sort_order);

create index roadmap_milestones_user_idx
  on public.roadmap_milestones (user_id);

create table public.roadmap_updates (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.creator_roadmaps (id) on delete cascade,
  milestone_id uuid references public.roadmap_milestones (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_kind public.milestone_source_kind not null default 'manual',
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index roadmap_updates_roadmap_created_idx
  on public.roadmap_updates (roadmap_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Idea Gate
-- ---------------------------------------------------------------------------

create table public.idea_gate_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idea_text text not null,
  recommendation public.idea_gate_recommendation not null default 'reshape',
  why text,
  evidence jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  missing_ingredient text,
  better_angle text,
  best_format text,
  status public.idea_gate_status not null default 'evaluated',
  related_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idea_gate_evaluations_user_created_idx
  on public.idea_gate_evaluations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Pre-Publish Lab
-- ---------------------------------------------------------------------------

create table public.pre_publish_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null default 'paste',
  source_ref text,
  input_text text not null,
  result jsonb not null default '{}'::jsonb,
  status public.pre_publish_status not null default 'reviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pre_publish_reviews_user_created_idx
  on public.pre_publish_reviews (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Editing Copilot plans
-- ---------------------------------------------------------------------------

create table public.editing_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_ref text,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index editing_plans_user_created_idx
  on public.editing_plans (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audience Miner
-- ---------------------------------------------------------------------------

create table public.audience_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source public.audience_comment_source not null default 'manual_paste',
  body text not null,
  post_id uuid references public.content_posts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audience_comments_user_created_idx
  on public.audience_comments (user_id, created_at desc);

create table public.audience_clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  cluster_type public.audience_cluster_type not null default 'other',
  summary text,
  comment_ids uuid[] not null default '{}',
  opportunity_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audience_clusters_user_idx
  on public.audience_clusters (user_id);

create table public.audience_language (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phrase text not null,
  category public.audience_language_category not null default 'phrase',
  frequency integer not null default 1 check (frequency >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audience_language_user_phrase_idx
  on public.audience_language (user_id, lower(phrase));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger creator_roadmaps_updated_at
  before update on public.creator_roadmaps
  for each row execute function public.handle_updated_at();

create trigger roadmap_milestones_updated_at
  before update on public.roadmap_milestones
  for each row execute function public.handle_updated_at();

create trigger idea_gate_evaluations_updated_at
  before update on public.idea_gate_evaluations
  for each row execute function public.handle_updated_at();

create trigger pre_publish_reviews_updated_at
  before update on public.pre_publish_reviews
  for each row execute function public.handle_updated_at();

create trigger editing_plans_updated_at
  before update on public.editing_plans
  for each row execute function public.handle_updated_at();

create trigger audience_comments_updated_at
  before update on public.audience_comments
  for each row execute function public.handle_updated_at();

create trigger audience_clusters_updated_at
  before update on public.audience_clusters
  for each row execute function public.handle_updated_at();

create trigger audience_language_updated_at
  before update on public.audience_language
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.creator_roadmaps enable row level security;
alter table public.roadmap_milestones enable row level security;
alter table public.roadmap_updates enable row level security;
alter table public.idea_gate_evaluations enable row level security;
alter table public.pre_publish_reviews enable row level security;
alter table public.editing_plans enable row level security;
alter table public.audience_comments enable row level security;
alter table public.audience_clusters enable row level security;
alter table public.audience_language enable row level security;

create policy "creator_roadmaps_all_own" on public.creator_roadmaps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "roadmap_milestones_all_own" on public.roadmap_milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "roadmap_updates_all_own" on public.roadmap_updates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "idea_gate_evaluations_all_own" on public.idea_gate_evaluations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pre_publish_reviews_all_own" on public.pre_publish_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "editing_plans_all_own" on public.editing_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "audience_comments_all_own" on public.audience_comments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "audience_clusters_all_own" on public.audience_clusters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "audience_language_all_own" on public.audience_language
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
