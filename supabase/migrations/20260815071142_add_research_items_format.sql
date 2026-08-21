alter table public.research_items add column if not exists format text;
create index if not exists research_items_user_format_idx on public.research_items (user_id, format) where format is not null;
