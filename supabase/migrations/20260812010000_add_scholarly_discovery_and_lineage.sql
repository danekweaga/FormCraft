-- Evidence-aware scholarly discovery metadata for the Psychology Library.

alter table public.psychology_sources
  drop constraint if exists psychology_sources_source_type_check;

alter table public.psychology_sources
  add constraint psychology_sources_source_type_check check (
    source_type in (
      'openalex',
      'doi',
      'pubmed',
      'semantic_scholar',
      'crossref',
      'core',
      'doaj',
      'repository',
      'paper_upload',
      'research_url',
      'book_notes'
    )
  );

alter table public.psychology_sources
  add column if not exists source_provider text,
  add column if not exists source_provider_id text,
  add column if not exists authors text[] not null default '{}',
  add column if not exists publication_year integer,
  add column if not exists journal text,
  add column if not exists study_type text check (
    study_type is null or study_type in (
      'meta_analysis',
      'systematic_review',
      'replication',
      'experiment',
      'observational',
      'review',
      'other'
    )
  ),
  add column if not exists abstract text,
  add column if not exists full_text_access text check (
    full_text_access is null or full_text_access in (
      'open',
      'uploaded_by_user',
      'metadata_only'
    )
  ),
  add column if not exists is_retracted boolean not null default false,
  add column if not exists cited_by_count integer;

create unique index if not exists psychology_sources_provider_id_uidx
  on public.psychology_sources (user_id, source_provider, source_provider_id);

-- Generic semantic lineage without duplicating domain objects.
create table if not exists public.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_type text not null,
  from_id uuid not null,
  relation text not null check (
    relation in (
      'inspired_by',
      'extracted_from',
      'used_by',
      'became',
      'published_as',
      'produced',
      'supports',
      'qualifies',
      'contradicts'
    )
  ),
  to_type text not null,
  to_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, from_type, from_id, relation, to_type, to_id)
);

create index if not exists entity_relationships_from_idx
  on public.entity_relationships (user_id, from_type, from_id);
create index if not exists entity_relationships_to_idx
  on public.entity_relationships (user_id, to_type, to_id);

alter table public.entity_relationships enable row level security;

create policy "entity_relationships_all_own" on public.entity_relationships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
