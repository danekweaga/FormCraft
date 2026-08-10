-- Growth L/M completion: creator persona, repurposing/series tracking,
-- durable notifications, and evidence-aware psychology principles.

alter table public.profiles
  add column if not exists what_i_make text,
  add column if not exists my_audience text,
  add column if not exists content_style text,
  add column if not exists script_style text,
  add column if not exists creator_profile_completed_at timestamptz;

create type public.repurposing_opportunity_status as enum (
  'suggested',
  'accepted',
  'dismissed',
  'completed',
  'not_worth'
);

create type public.content_series_status as enum (
  'planned',
  'active',
  'paused',
  'completed'
);

create type public.content_series_item_status as enum (
  'idea',
  'scripted',
  'ready',
  'published',
  'skipped'
);

create table if not exists public.repurposing_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_content_post_id uuid references public.content_posts (id) on delete cascade,
  source_research_item_id uuid references public.research_items (id) on delete cascade,
  opportunity_type text not null check (
    opportunity_type in (
      'remake',
      'follow_up',
      'comment_response',
      'carousel',
      'social_post',
      'research_to_script',
      'voice_note_to_script',
      'podcast_clips',
      'not_worth'
    )
  ),
  status public.repurposing_opportunity_status not null default 'suggested',
  title text not null,
  reason text not null,
  evidence jsonb not null default '[]'::jsonb,
  recommendation jsonb not null default '{}'::jsonb,
  output_canvas_node_id uuid references public.canvas_nodes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_content_post_id is not null or source_research_item_id is not null)
);

create index if not exists repurposing_opportunities_user_status_idx
  on public.repurposing_opportunities (user_id, status, created_at desc);

create unique index if not exists repurposing_opportunities_post_type_uidx
  on public.repurposing_opportunities (user_id, source_content_post_id, opportunity_type)
  where source_content_post_id is not null;

create table if not exists public.content_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  thesis text not null,
  format text,
  status public.content_series_status not null default 'planned',
  source_content_post_id uuid references public.content_posts (id) on delete set null,
  source_research_item_id uuid references public.research_items (id) on delete set null,
  canvas_board_id uuid references public.canvas_boards (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_series_user_status_idx
  on public.content_series (user_id, status, updated_at desc);

create table if not exists public.content_series_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id uuid not null references public.content_series (id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  title text not null,
  angle text,
  status public.content_series_item_status not null default 'idea',
  idea_gate_evaluation_id uuid references public.idea_gate_evaluations (id) on delete set null,
  canvas_node_id uuid references public.canvas_nodes (id) on delete set null,
  content_post_id uuid references public.content_posts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, ordinal)
);

create index if not exists content_series_items_series_idx
  on public.content_series_items (series_id, ordinal);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  dedupe_key text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notification_events_user_unread_idx
  on public.notification_events (user_id, created_at desc)
  where read_at is null;

create type public.psychology_principle_status as enum (
  'proposed',
  'active',
  'contested',
  'retired'
);

create table if not exists public.psychology_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (
    source_type in (
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
  ),
  title text not null,
  url text,
  doi text,
  citation text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists psychology_sources_user_doi_uidx
  on public.psychology_sources (user_id, doi);

create table if not exists public.psychology_principles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null,
  mechanism text,
  content_application text,
  limitations text,
  evidence_strength text not null default 'unknown' check (
    evidence_strength in ('unknown', 'limited', 'emerging', 'moderate', 'strong')
  ),
  status public.psychology_principle_status not null default 'proposed',
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.psychology_principle_sources (
  principle_id uuid not null references public.psychology_principles (id) on delete cascade,
  source_id uuid not null references public.psychology_sources (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (principle_id, source_id)
);

create trigger repurposing_opportunities_updated_at
  before update on public.repurposing_opportunities
  for each row execute function public.handle_updated_at();
create trigger content_series_updated_at
  before update on public.content_series
  for each row execute function public.handle_updated_at();
create trigger content_series_items_updated_at
  before update on public.content_series_items
  for each row execute function public.handle_updated_at();
create trigger psychology_sources_updated_at
  before update on public.psychology_sources
  for each row execute function public.handle_updated_at();
create trigger psychology_principles_updated_at
  before update on public.psychology_principles
  for each row execute function public.handle_updated_at();

alter table public.repurposing_opportunities enable row level security;
alter table public.content_series enable row level security;
alter table public.content_series_items enable row level security;
alter table public.notification_events enable row level security;
alter table public.psychology_sources enable row level security;
alter table public.psychology_principles enable row level security;
alter table public.psychology_principle_sources enable row level security;

create policy "repurposing_opportunities_all_own" on public.repurposing_opportunities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "content_series_all_own" on public.content_series
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "content_series_items_all_own" on public.content_series_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notification_events_all_own" on public.notification_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "psychology_sources_all_own" on public.psychology_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "psychology_principles_all_own" on public.psychology_principles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "psychology_principle_sources_all_own" on public.psychology_principle_sources
  for all using (
    exists (
      select 1 from public.psychology_principles p
      where p.id = principle_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.psychology_principles p
      where p.id = principle_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.psychology_sources s
      where s.id = source_id and s.user_id = auth.uid()
    )
  );
