-- Research Canvas: outlier → pattern → idea boards

create table if not exists public.canvas_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Research board',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canvas_boards_user_idx
  on public.canvas_boards (user_id, updated_at desc);

create table if not exists public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.canvas_boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  node_type text not null
    check (node_type in ('source', 'analysis', 'pattern', 'idea')),
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  research_item_id uuid references public.research_items (id) on delete set null,
  idea_gate_evaluation_id uuid references public.idea_gate_evaluations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canvas_nodes_board_idx
  on public.canvas_nodes (board_id, created_at);
create index if not exists canvas_nodes_research_item_idx
  on public.canvas_nodes (research_item_id)
  where research_item_id is not null;

create table if not exists public.canvas_edges (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.canvas_boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_node_id uuid not null references public.canvas_nodes (id) on delete cascade,
  to_node_id uuid not null references public.canvas_nodes (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  constraint canvas_edges_distinct check (from_node_id <> to_node_id),
  unique (board_id, from_node_id, to_node_id)
);

create trigger canvas_boards_updated_at
  before update on public.canvas_boards
  for each row execute function public.handle_updated_at();

create trigger canvas_nodes_updated_at
  before update on public.canvas_nodes
  for each row execute function public.handle_updated_at();

alter table public.canvas_boards enable row level security;
alter table public.canvas_nodes enable row level security;
alter table public.canvas_edges enable row level security;

create policy "canvas_boards_all_own" on public.canvas_boards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "canvas_nodes_all_own" on public.canvas_nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "canvas_edges_all_own" on public.canvas_edges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
