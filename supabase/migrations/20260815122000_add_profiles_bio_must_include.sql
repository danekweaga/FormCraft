-- Persist bio rewrite "must include" notes on the creator profile.
alter table public.profiles
  add column if not exists bio_must_include text;
