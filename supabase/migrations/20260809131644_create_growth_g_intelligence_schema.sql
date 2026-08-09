-- Growth Phase G — unified intelligence layer extensions

-- Performance lessons: richer statuses + lesson_type + evidence window
alter type public.lesson_status add value if not exists 'testing';
alter type public.lesson_status add value if not exists 'supported';

alter table public.performance_lessons
  add column if not exists lesson_type text not null default 'pattern',
  add column if not exists expires_at timestamptz,
  add column if not exists evidence_window jsonb not null default '{}'::jsonb,
  add column if not exists last_verified_at timestamptz;

-- User corrections take precedence over AI classification
alter table public.content_posts
  add column if not exists classification_locked boolean not null default false,
  add column if not exists classification_confidence numeric,
  add column if not exists classification_model text,
  add column if not exists classified_at timestamptz;

-- Audience insights (distinct from raw comments / clusters)
create type public.audience_insight_type as enum (
  'question',
  'pain_point',
  'desire',
  'objection',
  'misconception',
  'content_request',
  'language_pattern',
  'debate',
  'follow_up_opportunity'
);

create type public.audience_insight_status as enum (
  'active',
  'resolved',
  'archived'
);

create table if not exists public.audience_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_type public.audience_insight_type not null default 'question',
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  source_post_ids uuid[] not null default '{}',
  sample_size integer not null default 0,
  confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  status public.audience_insight_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audience_insights_user_status_idx
  on public.audience_insights (user_id, status, created_at desc);

-- Suggested roadmap updates requiring approval
create type public.roadmap_suggestion_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table if not exists public.roadmap_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  roadmap_id uuid not null references public.creator_roadmaps (id) on delete cascade,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  proposed_changes jsonb not null default '{}'::jsonb,
  status public.roadmap_suggestion_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roadmap_suggestions_user_status_idx
  on public.roadmap_suggestions (user_id, status, created_at desc);

-- Feedback / preference memory (application-level, not model training)
create table if not exists public.intelligence_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feedback_type text not null,
  subject_type text not null,
  subject_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_feedback_user_created_idx
  on public.intelligence_feedback (user_id, created_at desc);

-- AI usage / spend tracking
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_type text not null,
  model_tier text not null check (model_tier in ('cheap', 'standard', 'premium')),
  model_name text,
  estimated_input_tokens integer not null default 0,
  estimated_output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

-- Comment dedupe for connected imports
create unique index if not exists audience_comments_user_platform_comment_uidx
  on public.audience_comments (
    user_id,
    ((metadata ->> 'platform_comment_id'))
  )
  where (metadata ->> 'platform_comment_id') is not null;

create trigger audience_insights_updated_at
  before update on public.audience_insights
  for each row execute function public.handle_updated_at();

create trigger roadmap_suggestions_updated_at
  before update on public.roadmap_suggestions
  for each row execute function public.handle_updated_at();

alter table public.audience_insights enable row level security;
alter table public.roadmap_suggestions enable row level security;
alter table public.intelligence_feedback enable row level security;
alter table public.ai_usage_events enable row level security;

create policy "audience_insights_all_own" on public.audience_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "roadmap_suggestions_all_own" on public.roadmap_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "intelligence_feedback_all_own" on public.intelligence_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_usage_events_all_own" on public.ai_usage_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
