-- Creator-facing profile strategy: saved bio reference and explicit pillars.
-- This does not edit a connected social account; it is high-priority context
-- for FormCraft's audit and generation workflows.

alter table public.profiles
  add column if not exists social_bio text,
  add column if not exists content_pillars text[] not null default '{}';

comment on column public.profiles.social_bio is
  'Creator-managed reference copy for a public social bio; FormCraft never publishes it automatically.';

comment on column public.profiles.content_pillars is
  'Creator-approved content pillars used for drift and coverage analysis.';

