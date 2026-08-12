-- TikTok discovery is provided by an explicitly labelled third-party adapter.
-- The original Research Radar constraint predated that provider and rejected
-- otherwise valid TikTok rows during ingestion.

alter table public.research_items
  drop constraint if exists research_items_source_check;

alter table public.research_items
  add constraint research_items_source_check check (
    source in ('official_api', 'third_party_api', 'manual_reference')
  );
