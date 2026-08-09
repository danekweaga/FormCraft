# FormCraft Architecture

## Application architecture

```
Browser
  └─ Next.js App Router (src/app)
       ├─ (auth) public sign-in / sign-up
       ├─ (app) protected shell
       │    ├─ Today, placeholders, Settings/Profile
       │    ├─ /knowledge Teach FormCraft
       │    ├─ /my-content personal intelligence
       │    └─ /analyze Video Breakdown Lab
       ├─ src/proxy.ts auth refresh + route guards
       └─ Server Actions + Server Components
            └─ Supabase (Auth, Postgres, Storage)
```

- Server Components by default; Client Components for interactive forms/dialogs
- Mutations via Server Actions with Zod validation
- Route protection in `src/proxy.ts` (Next.js 16 Proxy; middleware renamed) using `getClaims()` + pure redirect policy in `src/lib/auth/route-guards.ts`

## Database architecture

See [DATABASE.md](DATABASE.md).

- One schema owner per user (`user_id` + RLS)
- Knowledge: collections → documents → chunks (+ tags)
- My Content: posts, clusters, performance lessons, experiments, weekly reports
- Analyze: video_analyses (versioned via `parent_analysis_id`), saved_patterns
- pgvector column on `knowledge_chunks.embedding` nullable until embedding pipeline ships

## AI-service architecture

`src/lib/ai/context/context-builder.ts` composes typed context slots:

1. Current task *(deferred)*
2. Current project *(deferred)*
3. Brand Brain *(deferred)*
4. Voice profile *(deferred)*
5. Teach FormCraft knowledge *(wired via KnowledgeRetriever)*
6. Selected research *(deferred)*
7. Project memories *(deferred)*
8. Recent performance / My Content lessons *(deferred wiring)*

Every included item carries `ProvenanceEntry` (`sourceType`, `sourceId`, `sourceTitle`) so future UI can show “Used knowledge from: …”.

**No LLM provider is called in this iteration.** Analyze uses heuristic transcript parsing only, with explicit confidence notes.

## File-processing architecture

Knowledge pipeline (`src/lib/knowledge/pipeline`):

```
Upload/Note → validate → store privately → extract → normalize → chunk → (optional embed) → ready|failed
```

- PDF extraction fails loudly when no text is recovered
- Original files remain in private Storage
- Retry resets status and re-runs processing
- Processing is synchronous in Server Actions for now

## Knowledge-retrieval architecture

`KnowledgeRetriever` interface in `src/lib/knowledge/retrieval/types.ts`.

Initial implementation: `PostgresKnowledgeRetriever` (Postgres FTS + importance + recency).

Future: vector similarity and hybrid ranking without changing callers.

## Background-job architecture

Documented, not yet a worker fleet.

- Current: Server Action triggers processing inline
- Future: `processing_jobs` queue / Supabase Edge Functions / worker for PDF, transcription, embeddings, social sync
- Analyze and My Content heavy jobs will share the same job abstraction when introduced

## Social-monitoring architecture

**Deferred.** No Instagram/TikTok/YouTube/LinkedIn/X/Threads clients are implemented.

My Content schema and UI accept:

- Manual entry (implemented)
- Future: connected accounts, CSV, URL ingest, video/transcript upload, FormCraft drafts

All rows store `source` + `source_label` so provenance stays honest.

## My Content intelligence architecture

Loop:

```
Ingest posts → store metrics (nullable) → classify → baseline → relative performance
→ insights/lessons → user confirm/reject → influence generation (future)
```

`performance_lessons.status`: suggested | confirmed | rejected | expired.

Only confirmed / high-confidence lessons should heavily influence future generation.

Opportunity engine (future) combines My Content + Research outliers + Brand Brain + Teach FormCraft + goals.

## Video Breakdown Lab architecture

```
Input (upload | URL | transcript | My Content post)
  → evidence inventory (audio/visual/transcript)
  → mode (quick | deep | expert)
  → structured Zod result
  → persist versioned analysis
```

Rules:

- No visual claims without frame evidence (`has_visual_evidence`)
- Transcript-only path must declare visual/editing unavailable
- Reanalyze creates a new row linked by `parent_analysis_id`
- Knowledge retrieval can inform critique via provenance list (`knowledge_sources`)

## Security approach

- RLS on every user table
- Private Storage buckets (`knowledge-files`, `content-media`, `analysis-media`)
- Server-side session checks before upload
- MIME + size validation
- Service role client only in server modules (`src/lib/supabase/admin.ts`)
- Signed URLs for private file access when needed
- React text escaping for extracted content (no `dangerouslySetInnerHTML`)

## Expected external services

| Service | Status |
|---------|--------|
| Supabase Auth / DB / Storage | Required now |
| pgvector | Schema ready |
| OpenAI / Anthropic (LLM + embeddings) | Future |
| Social platform APIs | Future |
| Transcription (Whisper etc.) | Future |
| Frame sampling / ffmpeg | Future |

## Deferred functionality

- Social OAuth + CSV ingest
- Full My Content insights / Ask My Content / remake finder / weekly report generation
- LLM-powered Analyze modes, compare mode, rewrite studio
- Research outliers, Canvas, Create/Plan/Performance product surfaces
- Embedding generation + hybrid retrieval
- Async job workers
