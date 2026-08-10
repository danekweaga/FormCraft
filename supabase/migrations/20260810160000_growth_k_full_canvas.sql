-- Growth K: Full Canvas — widen node/edge types, board metadata, templates

alter table public.canvas_boards
  add column if not exists description text,
  add column if not exists template_key text,
  add column if not exists viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb;

-- Drop legacy narrow CHECK on node_type (constraint name may vary)
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.canvas_nodes'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%node_type%';
  if cname is not null then
    execute format('alter table public.canvas_nodes drop constraint %I', cname);
  end if;
end $$;

alter table public.canvas_nodes
  add column if not exists width numeric,
  add column if not exists height numeric,
  add column if not exists content_post_id uuid references public.content_posts (id) on delete set null,
  add column if not exists analysis_id uuid references public.video_analyses (id) on delete set null,
  add column if not exists experiment_id uuid references public.content_experiments (id) on delete set null,
  add column if not exists knowledge_document_id uuid references public.knowledge_documents (id) on delete set null,
  add column if not exists parent_frame_id uuid references public.canvas_nodes (id) on delete set null;

alter table public.canvas_nodes
  add constraint canvas_nodes_node_type_check check (
    node_type in (
      'source',
      'source_post',
      'external_outlier',
      'my_content',
      'video',
      'image',
      'document',
      'website',
      'audio',
      'voice_note',
      'knowledge',
      'analysis',
      'pattern',
      'audience_insight',
      'idea',
      'script',
      'draft',
      'experiment',
      'performance_lesson',
      'roadmap_milestone',
      'ai_node',
      'note',
      'frame'
    )
  );

alter table public.canvas_edges
  add column if not exists edge_type text not null default 'related_to';

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.canvas_edges'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%edge_type%';
  if cname is not null then
    execute format('alter table public.canvas_edges drop constraint %I', cname);
  end if;
end $$;

alter table public.canvas_edges
  add constraint canvas_edges_edge_type_check check (
    edge_type in (
      'inspired_by',
      'uses_pattern',
      'source_for',
      'evidence_for',
      'contradicts',
      'similar_to',
      'converted_into',
      'resulted_in',
      'tested_by',
      'supports_experiment',
      'personal_example_for',
      'part_of_series',
      'part_of_project',
      'related_to',
      'analyzes',
      'extracts'
    )
  );

-- Backfill freeform labels into edge_type when recognizable
update public.canvas_edges
set edge_type = case lower(coalesce(label, ''))
  when 'analyzes' then 'analyzes'
  when 'extracts' then 'extracts'
  when 'inspired by' then 'inspired_by'
  when 'uses pattern' then 'uses_pattern'
  else edge_type
end
where edge_type = 'related_to';

create table if not exists public.canvas_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists canvas_templates_user_idx
  on public.canvas_templates (user_id, created_at desc);

create trigger canvas_templates_updated_at
  before update on public.canvas_templates
  for each row execute function public.handle_updated_at();

alter table public.canvas_templates enable row level security;

create policy "canvas_templates_select" on public.canvas_templates
  for select using (is_system = true or auth.uid() = user_id);
create policy "canvas_templates_insert_own" on public.canvas_templates
  for insert with check (auth.uid() = user_id and is_system = false);
create policy "canvas_templates_update_own" on public.canvas_templates
  for update using (auth.uid() = user_id and is_system = false)
  with check (auth.uid() = user_id and is_system = false);
create policy "canvas_templates_delete_own" on public.canvas_templates
  for delete using (auth.uid() = user_id and is_system = false);

create index if not exists canvas_nodes_content_post_idx
  on public.canvas_nodes (content_post_id)
  where content_post_id is not null;
create index if not exists canvas_nodes_analysis_idx
  on public.canvas_nodes (analysis_id)
  where analysis_id is not null;
