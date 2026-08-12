-- Evidence-aware retention curves for Growth I. Values above 1 are valid replays.

create table if not exists public.analysis_retention_curves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.video_analyses (id) on delete cascade,
  provider text not null default 'manual',
  source_label text,
  duration_seconds numeric not null check (duration_seconds > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_retention_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  curve_id uuid not null references public.analysis_retention_curves (id) on delete cascade,
  elapsed_seconds numeric not null check (elapsed_seconds >= 0),
  position_ratio numeric not null check (position_ratio >= 0 and position_ratio <= 1.01),
  audience_watch_ratio numeric not null check (audience_watch_ratio >= 0 and audience_watch_ratio <= 5),
  relative_retention_performance numeric,
  created_at timestamptz not null default now(),
  unique (curve_id, position_ratio)
);

create index if not exists analysis_retention_curves_analysis_idx
  on public.analysis_retention_curves (analysis_id, created_at desc);
create index if not exists analysis_retention_points_curve_idx
  on public.analysis_retention_points (curve_id, position_ratio);

alter table public.analysis_retention_curves enable row level security;
alter table public.analysis_retention_points enable row level security;

create policy "analysis_retention_curves_all_own" on public.analysis_retention_curves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "analysis_retention_points_all_own" on public.analysis_retention_points
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

