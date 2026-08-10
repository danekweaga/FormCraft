-- Growth J: Pre-Publish Lab + Creative Editing Copilot

create type public.editing_style_source as enum (
  'personal',
  'reference',
  'custom',
  'experiment',
  'knowledge'
);

create type public.creative_direction as enum (
  'minimal_yap',
  'clean_explainer',
  'high_energy',
  'storytelling',
  'meme_heavy',
  'my_style',
  'reference',
  'custom'
);

create type public.editing_feedback_kind as enum (
  'good',
  'not_my_style',
  'too_much',
  'too_little',
  'never',
  'save_preference'
);

alter table public.pre_publish_reviews
  add column if not exists analysis_id uuid references public.video_analyses (id) on delete set null,
  add column if not exists content_post_id uuid references public.content_posts (id) on delete set null,
  add column if not exists creative_direction public.creative_direction,
  add column if not exists checklist jsonb not null default '{}'::jsonb,
  add column if not exists editing_plan_id uuid references public.editing_plans (id) on delete set null,
  add column if not exists result_version text not null default 'pre-publish-v1',
  add column if not exists active_experiment_id uuid references public.content_experiments (id) on delete set null;

create index if not exists pre_publish_reviews_analysis_idx
  on public.pre_publish_reviews (analysis_id)
  where analysis_id is not null;

alter table public.editing_plans
  add column if not exists review_id uuid references public.pre_publish_reviews (id) on delete set null,
  add column if not exists analysis_id uuid references public.video_analyses (id) on delete set null,
  add column if not exists creative_direction public.creative_direction,
  add column if not exists style_profile_id uuid,
  add column if not exists title text;

create table if not exists public.editing_style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source_type public.editing_style_source not null default 'custom',
  description text,
  principles jsonb not null default '[]'::jsonb,
  observed_patterns jsonb not null default '[]'::jsonb,
  preferred_complexity text,
  user_confirmed boolean not null default false,
  source_analysis_id uuid references public.video_analyses (id) on delete set null,
  source_research_item_id uuid references public.research_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editing_style_profiles_user_idx
  on public.editing_style_profiles (user_id, created_at desc);

-- Late FK for style_profile_id on editing_plans
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'editing_plans_style_profile_id_fkey'
  ) then
    alter table public.editing_plans
      add constraint editing_plans_style_profile_id_fkey
      foreign key (style_profile_id) references public.editing_style_profiles (id)
      on delete set null;
  end if;
end $$;

create table if not exists public.editing_suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  editing_plan_id uuid references public.editing_plans (id) on delete cascade,
  review_id uuid references public.pre_publish_reviews (id) on delete cascade,
  suggestion_key text not null,
  feedback public.editing_feedback_kind not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists editing_suggestion_feedback_user_idx
  on public.editing_suggestion_feedback (user_id, created_at desc);

create trigger editing_style_profiles_updated_at
  before update on public.editing_style_profiles
  for each row execute function public.handle_updated_at();

alter table public.editing_style_profiles enable row level security;
alter table public.editing_suggestion_feedback enable row level security;

create policy "editing_style_profiles_all_own" on public.editing_style_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "editing_suggestion_feedback_all_own" on public.editing_suggestion_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
