-- Remove values previously populated from titles or hook-type labels.
-- Transcript-backed analysis rows are preserved.
update public.research_items
set hook_text = null
where hook_text is not null
  and (
    hook_text = title
    or coalesce(analysis ->> 'evidenceBasis', 'metadata_only') = 'metadata_only'
  );

update public.content_posts
set hook_text = null
where hook_text is not null
  and classification is not null
  and hook_text = classification ->> 'hook_type';
