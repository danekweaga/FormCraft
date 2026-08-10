-- Growth I: Video Breakdown Lab extensions

create type public.analysis_source_type as enum (
  'my_content',
  'external_research',
  'draft',
  'unpublished_video',
  'script_only',
  'transcript_only'
);

alter table public.video_analyses
  add column if not exists source_type public.analysis_source_type,
  add column if not exists research_item_id uuid references public.research_items (id) on delete set null,
  add column if not exists raw_transcript text,
  add column if not exists normalized_transcript text,
  add column if not exists transcript_provider text,
  add column if not exists transcript_language text,
  add column if not exists transcript_confidence numeric,
  add column if not exists processing_stages jsonb not null default '[]'::jsonb,
  add column if not exists analysis_version integer not null default 1,
  add column if not exists input_hash text,
  add column if not exists context_hash text,
  add column if not exists frames_analyzed jsonb not null default '[]'::jsonb,
  add column if not exists user_corrections jsonb not null default '{}'::jsonb,
  add column if not exists estimated_cost_usd numeric,
  add column if not exists saved boolean not null default false,
  add column if not exists timestamped_transcript jsonb;

create index if not exists video_analyses_user_source_idx
  on public.video_analyses (user_id, source_type, created_at desc);
create index if not exists video_analyses_research_item_idx
  on public.video_analyses (research_item_id)
  where research_item_id is not null;
create index if not exists video_analyses_input_hash_idx
  on public.video_analyses (user_id, input_hash, analysis_mode);

create table if not exists public.analysis_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.video_analyses (id) on delete cascade,
  evidence_type text not null,
  start_seconds numeric,
  end_seconds numeric,
  transcript_excerpt text,
  frame_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analysis_evidence_analysis_idx
  on public.analysis_evidence (analysis_id, evidence_type);

create table if not exists public.analysis_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  left_analysis_id uuid not null references public.video_analyses (id) on delete cascade,
  right_analysis_id uuid not null references public.video_analyses (id) on delete cascade,
  comparison_type text not null default 'side_by_side',
  result jsonb not null default '{}'::jsonb,
  model_name text,
  created_at timestamptz not null default now()
);

create index if not exists analysis_comparisons_user_idx
  on public.analysis_comparisons (user_id, created_at desc);

alter table public.analysis_evidence enable row level security;
alter table public.analysis_comparisons enable row level security;

create policy "analysis_evidence_all_own" on public.analysis_evidence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "analysis_comparisons_all_own" on public.analysis_comparisons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Backfill source_type from subject/input when null
update public.video_analyses
set source_type = case
  when subject_type = 'own_content' or input_type = 'my_content_post' then 'my_content'::public.analysis_source_type
  when subject_type = 'draft' then 'draft'::public.analysis_source_type
  when subject_type = 'unpublished' then 'unpublished_video'::public.analysis_source_type
  when subject_type in ('competitor_reference', 'viral_outlier') then 'external_research'::public.analysis_source_type
  else 'transcript_only'::public.analysis_source_type
end
where source_type is null;

update public.video_analyses
set raw_transcript = coalesce(raw_transcript, transcript),
    normalized_transcript = coalesce(normalized_transcript, transcript)
where transcript is not null;
