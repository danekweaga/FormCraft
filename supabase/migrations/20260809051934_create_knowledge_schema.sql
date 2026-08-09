-- Teach FormCraft / Knowledge Base
create extension if not exists vector;

create type public.knowledge_type as enum (
  'strategy',
  'brand',
  'voice',
  'research',
  'framework',
  'example',
  'personal_context',
  'product',
  'reference',
  'instruction',
  'other'
);

create type public.knowledge_source_type as enum (
  'manual_note',
  'upload',
  'url'
);

create type public.processing_status as enum (
  'uploaded',
  'processing',
  'ready',
  'failed'
);

create type public.importance_level as enum (
  'low',
  'normal',
  'high',
  'critical'
);

create table public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index knowledge_collections_user_name_uidx
  on public.knowledge_collections (user_id, lower(name));

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid references public.knowledge_collections (id) on delete set null,
  title text not null,
  description text,
  knowledge_type public.knowledge_type not null default 'other',
  source_type public.knowledge_source_type not null default 'manual_note',
  source_url text,
  storage_path text,
  mime_type text,
  original_filename text,
  raw_text text,
  processing_status public.processing_status not null default 'uploaded',
  processing_error text,
  importance public.importance_level not null default 'normal',
  is_active boolean not null default true,
  include_in_ai boolean not null default true,
  is_archived boolean not null default false,
  is_demo boolean not null default false,
  is_favourite boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_documents_user_collection_idx
  on public.knowledge_documents (user_id, collection_id);
create index knowledge_documents_user_status_idx
  on public.knowledge_documents (user_id, processing_status);
create index knowledge_documents_user_created_idx
  on public.knowledge_documents (user_id, created_at desc);
create index knowledge_documents_search_idx
  on public.knowledge_documents using gin (search_vector);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index knowledge_chunks_user_doc_idx
  on public.knowledge_chunks (user_id, document_id);

create table public.knowledge_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index knowledge_tags_user_name_uidx
  on public.knowledge_tags (user_id, lower(name));

create table public.knowledge_document_tags (
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  tag_id uuid not null references public.knowledge_tags (id) on delete cascade,
  primary key (document_id, tag_id)
);

create or replace function public.knowledge_documents_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.raw_text, '')), 'C');
  new.updated_at := now();
  return new;
end;
$$;

create trigger knowledge_documents_search_vector
  before insert or update of title, description, raw_text
  on public.knowledge_documents
  for each row execute function public.knowledge_documents_search_vector_update();

create trigger knowledge_collections_updated_at
  before update on public.knowledge_collections
  for each row execute function public.handle_updated_at();

alter table public.knowledge_collections enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_tags enable row level security;
alter table public.knowledge_document_tags enable row level security;

create policy "knowledge_collections_all_own" on public.knowledge_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "knowledge_documents_all_own" on public.knowledge_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "knowledge_chunks_all_own" on public.knowledge_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "knowledge_tags_all_own" on public.knowledge_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "knowledge_document_tags_select_own" on public.knowledge_document_tags
  for select using (
    exists (
      select 1 from public.knowledge_documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );

create policy "knowledge_document_tags_insert_own" on public.knowledge_document_tags
  for insert with check (
    exists (
      select 1 from public.knowledge_documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
    and exists (
      select 1 from public.knowledge_tags t
      where t.id = tag_id and t.user_id = auth.uid()
    )
  );

create policy "knowledge_document_tags_delete_own" on public.knowledge_document_tags
  for delete using (
    exists (
      select 1 from public.knowledge_documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-files',
  'knowledge-files',
  false,
  10485760,
  array['text/plain', 'text/markdown', 'application/pdf', 'text/x-markdown']
)
on conflict (id) do nothing;

create policy "knowledge_files_select_own"
  on storage.objects for select
  using (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "knowledge_files_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "knowledge_files_update_own"
  on storage.objects for update
  using (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "knowledge_files_delete_own"
  on storage.objects for delete
  using (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = auth.uid()::text);
