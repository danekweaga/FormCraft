alter table public.research_items
  add column if not exists transcript text,
  add column if not exists transcript_provider text,
  add column if not exists transcript_language text,
  add column if not exists transcript_segments jsonb not null default '[]'::jsonb,
  add column if not exists transcript_retrieved_at timestamptz;

comment on column public.research_items.transcript is
  'Cached spoken transcript. Never populate this from a post caption.';

comment on column public.research_items.transcript_provider is
  'Provider that returned the cached spoken transcript, such as supadata_auto or youtube_captions.';
