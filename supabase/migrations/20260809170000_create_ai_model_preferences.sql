-- Per-user OpenRouter model assignment for each FormCraft AI task.
create table if not exists public.ai_model_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_type text not null,
  model_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_type),
  constraint ai_model_preferences_task_type_check check (
    task_type in (
      'content_analysis',
      'idea_evaluation',
      'idea_generation',
      'script_generation',
      'roadmap_review',
      'experiment_analysis',
      'audience_analysis',
      'performance_review',
      'pre_publish_review',
      'editing_guidance',
      'today_recommendation',
      'content_classification',
      'lesson_generation',
      'weekly_review'
    )
  ),
  constraint ai_model_preferences_model_name_check check (
    model_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.:-]+$'
    and char_length(model_name) <= 200
  )
);

create index if not exists ai_model_preferences_user_updated_idx
  on public.ai_model_preferences (user_id, updated_at desc);

drop trigger if exists ai_model_preferences_updated_at
  on public.ai_model_preferences;
create trigger ai_model_preferences_updated_at
  before update on public.ai_model_preferences
  for each row execute function public.handle_updated_at();

alter table public.ai_model_preferences enable row level security;

drop policy if exists "ai_model_preferences_all_own"
  on public.ai_model_preferences;
create policy "ai_model_preferences_all_own"
  on public.ai_model_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
