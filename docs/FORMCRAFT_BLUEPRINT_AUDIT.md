# FormCraft deep-research blueprint audit

Audited against `deep-research-report.md` on 2026-08-12. This document uses four statuses:

- **Complete**: implemented as a real persisted workflow, with no fake provider data.
- **Partial**: useful pieces exist, but the full closed loop is not complete.
- **Blocked**: FormCraft has an honest boundary because a provider, credential, approval, or worker is unavailable.
- **Missing**: not implemented yet.

## Capability matrix

| Capability | Status | Evidence / limitation |
| --- | --- | --- |
| Provider abstraction and capability-driven connection UI | Complete | Social providers expose configuration and capability checks; credentials remain server-side. |
| Owned Instagram, TikTok, and YouTube account connections | Complete when provider-approved | OAuth, encrypted token persistence, sync routes, and connection health exist. Provider scopes and app review still control the data returned. |
| External YouTube creator discovery | Complete | Watchlists scan imported channels and persist canonical posts and snapshots. |
| External TikTok creator discovery | Blocked by provider contract | The adapter is implemented for TikTokAPI.store. It only works with an active compatible API key/plan and valid creator handles. |
| External Instagram competitor discovery | Blocked | Meta's owned-account API is not a general public-creator search API. No compliant third-party discovery provider is configured. Instagram creator references remain manual. |
| Canonical content records and metric snapshots | Complete | Research posts, owned content, provider IDs, deduplication, and time-series snapshots are persisted. |
| Creator-relative outlier scoring | Complete | Each candidate uses the median of its 5–30 prior same-platform creator posts; the scored post is excluded. A disclosed same-platform cohort fallback is used when creator history is insufficient. |
| Age-adjusted 6h/24h/72h outlier cohorts | Partial | Snapshot and velocity infrastructure exists, but scheduled age-bucket baselines are not yet end-to-end. |
| Watchlists, filters, feedback, save/analyze-on-click | Complete | Date/view/outlier/platform filters, watchlist refresh, relevance feedback, select-all, and explicit deep-analysis actions exist. |
| URL/media/transcript/frame analysis | Partial | YouTube transcript ingestion and browser-assisted frame capture exist. A durable background media worker with FFmpeg/ASR retries is not configured. |
| Transcript-first hooks and structured analysis | Complete where transcript is available | Analysis records transcript provenance and uses structured outputs. Captions are not silently presented as transcripts. |
| AI task-role model routing and per-task selection | Complete | OpenRouter models are selected by task/tier, with user preferences, token estimation, daily/monthly budgets, Zod validation, usage logs, caching, and provenance. |
| Knowledge ingestion, FTS, vectors, and context assembly | Complete | Chunking, Postgres FTS, pgvector storage/retrieval, deduplication, context ranking, and token budgets are implemented. |
| Prompt-injection boundary for retrieved context | Complete | Retrieved sources are explicitly serialized as untrusted evidence, never instructions; regression coverage protects the boundary. |
| Canvas entity references | Complete | Canvas references domain entities without replacing canonical domain persistence. |
| Psychology starter evidence library | Complete | Cited sources, bounded applications, mechanisms, limitations, strength, and source links are persisted. |
| Scholarly discovery | Complete with OpenAlex key | OpenAlex search normalizes DOI, authors, year, venue, study type, abstract, citations, OA status, and retraction status. Saving refetches the canonical server-side record. |
| Crossref/Unpaywall/CORE enrichment | Missing | OpenAlex is the first real provider. Additional provider adapters and full-text enrichment are not implemented. |
| Experiments and learning loop | Complete | Experiments, variants, observations, performance lessons, idea gates, Today, and roadmap feedback are persisted and linked through existing domain flows. |
| Generic content lineage graph | Partial | The RLS-protected relationship table and relation vocabulary exist. All creation/publish flows do not yet write every possible lineage edge. |
| Durable scheduled orchestration | Partial | Cron endpoints and idempotent scan patterns exist. A queue/worker system with durable retries and dead-letter handling is not configured. |
| RLS and server-only credentials | Complete at schema/application level | User-owned tables have RLS and OAuth/API tokens stay server-side. A two-user integration suite against a live Supabase test project remains missing. |

## Honest runtime dependencies

FormCraft must not show a provider as operational unless its health check passes.

- `OPENROUTER_API_KEY`: AI generation and analysis.
- `YOUTUBE_API_KEY`: YouTube public discovery.
- `TIKTOK_DATA_API_KEY`: TikTokAPI.store discovery adapter; the external service must accept the key and endpoint contract.
- `OPENALEX_API_KEY`: Psychology scholarly search.
- Meta/TikTok OAuth credentials and approved scopes: owned-account sync only.
- `CRON_SECRET`: production scheduled endpoints.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: stable Server Action encryption across production instances/deployments.

## Next engineering slices

1. Add scheduled 6h/24h/72h snapshot capture and age-bucket outlier baselines.
2. Move media download/transcription/frame extraction to an idempotent background worker with retries.
3. Write lineage edges from every save, remix, idea, script, project, and published-content flow.
4. Add Crossref and Unpaywall enrichment behind the scholarly provider interface.
5. Add two-user RLS integration tests and provider contract fixtures for every external adapter.

This audit deliberately does not label provider-blocked or scaffold-only behavior as complete.
