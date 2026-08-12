-- Persistent, evidence-backed creator recommendations for research watchlists.

create table if not exists public.research_creator_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watchlist_id uuid not null references public.research_watchlists (id) on delete cascade,
  external_creator_id uuid not null references public.external_creators (id) on delete cascade,
  score numeric not null default 0,
  reasons text[] not null default '{}',
  matched_topics text[] not null default '{}',
  seed_creator_ids uuid[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, watchlist_id, external_creator_id)
);

create index if not exists research_creator_suggestions_watchlist_idx
  on public.research_creator_suggestions (watchlist_id, status, score desc);

create trigger research_creator_suggestions_updated_at
  before update on public.research_creator_suggestions
  for each row execute function public.handle_updated_at();

alter table public.research_creator_suggestions enable row level security;

create policy "research_creator_suggestions_all_own"
  on public.research_creator_suggestions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.research_watchlists watchlist
      where watchlist.id = watchlist_id
        and watchlist.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.external_creators creator
      where creator.id = external_creator_id
        and creator.user_id = auth.uid()
    )
  );
