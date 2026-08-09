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
       │    ├─ /analyze Video Breakdown Lab
       │    ├─ /roadmap Creator Roadmap
       │    ├─ /experiments Experiment Lab
       │    ├─ /audience Audience Miner
       │    ├─ /pre-publish Pre-Publish Lab
       │    └─ /idea-gate Idea Gate
       ├─ src/proxy.ts auth refresh + route guards
       └─ Server Actions + Server Components
            └─ Supabase (Auth, Postgres, Storage)
```

- Server Components by default; Client Components for interactive forms/dialogs
- Mutations via Server Actions with Zod validation
- Route protection in `src/proxy.ts` (Next.js 16 Proxy; middleware renamed) using `getClaims()` + pure redirect policy in `src/lib/auth/route-guards.ts`

## Database architecture

See [DATABASE.md](DATABASE.md).

- One schema owner per user (`user_id` + RLS) — personal-use first
- Knowledge: collections → documents → chunks (+ tags)
- My Content: posts, clusters, performance lessons, experiments, weekly reports
- Analyze: video_analyses (versioned via `parent_analysis_id`), saved_patterns
- Creator Growth: roadmaps/milestones/updates, idea_gate_evaluations, pre_publish_reviews, editing_plans, audience_* 
- pgvector column on `knowledge_chunks.embedding` nullable until embedding pipeline ships

## Unified learning loop

```
Knowledge + Brand context
        ↓
   Roadmap (aim)
        ↓
 Idea Gate → Create → Pre-Publish → Editing Copilot
        ↓
     Publish / ingest (My Content)
        ↓
 Analyze + performance lessons
        ↓
 Experiment Lab ↔ Audience Miner
        ↓
 Update Roadmap milestones + Teach FormCraft
```

**Implemented today:** Knowledge, My Content manual ingest, Analyze heuristics, and manual/heuristic scaffolds for Roadmap, Experiments, Idea Gate, Pre-Publish, Audience comments.

**Deferred:** automated milestone suggestions, LLM critiques, social sync, cluster mining, edit-plan generation.

## Creator Growth systems

### Roadmap

Tracks a creator goal, current phase, progress, and milestones. Milestone `source_kind` is `manual` | `auto` | `ai_suggested`. Auto/AI paths must only write when a real signal exists — never fabricate progress. `roadmap_updates` is an append-only journal for manual notes and future system events.

### Experiment Lab

Builds on `content_experiments` (My Content). Additive columns support hypothesis design: primary variable, variants, control variables, primary/secondary metrics, sample targets, observations, and structured `conclusion_state`. UI currently supports hypothesis create/list only.

### Idea Gate

Paste an idea → store `idea_gate_evaluations` with recommendation (`pursue|reshape|park|kill`). Current path uses local heuristics + explicit “full AI deferred” notes. Related Knowledge / My Content / Analyze ids go in `related_ids` jsonb when wiring ships.

### Pre-Publish Lab

Paste a script → store `pre_publish_reviews` with `result` jsonb. Stub result records heuristic flags and defers LLM stress-testing. Future: score against Teach FormCraft rules, confirmed lessons, and brand voice.

### Editing Copilot

`editing_plans` stores structured cut/reorder/caption plans. Schema only in this iteration; generation deferred (no fake editor AI).

### Audience Miner

Manual comment paste into `audience_comments`. Future clustering fills `audience_clusters` and phrase bank `audience_language`. Connected-account ingest deferred.

### @ references (planned)

Authors will `@` Knowledge docs, posts, analyses, experiments, and audience clusters into Create / Idea Gate / Pre-Publish. Resolver will return provenance-aware context slots — not implemented yet.

### Multi-model workspace (planned)

Connections + Models routes remain placeholders. Future: user-selected providers/models per task with usage metering. **No provider keys or stubbed completions in this iteration.**

## How growth connects to existing systems

| System | Consumes | Feeds |
|--------|----------|-------|
| Knowledge | User teaching | Idea Gate, Pre-Publish, context builder |
| My Content | Published posts/metrics | Experiments, Audience (`post_id`), lessons → Roadmap |
| Analyze | Transcripts / future media | Editing plans, Pre-Publish patterns, Knowledge examples |
| Context builder | All of the above (mostly deferred slots) | Future generation surfaces |

`src/lib/ai/context/context-builder.ts` today wires Teach FormCraft only. Growth slots (roadmap goal, confirmed lessons, audience language, experiment conclusions) are architectural — not fabricated.

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
9. Roadmap goal / active milestones *(planned)*
10. Audience language / clusters *(planned)*
11. Experiment conclusions *(planned)*

Every included item carries `ProvenanceEntry` (`sourceType`, `sourceId`, `sourceTitle`) so future UI can show “Used knowledge from: …”.

**No LLM provider is called in this iteration.** Analyze, Idea Gate, and Pre-Publish use heuristics only, with explicit deferred notes in persisted JSON/text.

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
- Future: `processing_jobs` queue / Supabase Edge Functions / worker for PDF, transcription, embeddings, social sync, audience clustering
- Analyze, My Content, and Audience heavy jobs will share the same job abstraction when introduced

## Social-monitoring architecture

**Deferred.** No Instagram/TikTok/YouTube/LinkedIn/X/Threads clients are implemented.

My Content and Audience schemas accept:

- Manual entry / paste (implemented)
- Future: connected accounts, CSV, URL ingest, video/transcript upload, FormCraft drafts

All rows store provenance fields (`source`, `source_label`, or `audience_comment_source`) so integrations stay honest.

## My Content intelligence architecture

Loop:

```
Ingest posts → store metrics (nullable) → classify → baseline → relative performance
→ insights/lessons → user confirm/reject → influence generation (future)
```

`performance_lessons.status`: suggested | confirmed | rejected | expired.

Only confirmed / high-confidence lessons should heavily influence future generation and Roadmap auto-milestones.

Opportunity engine (future) combines My Content + Research outliers + Brand Brain + Teach FormCraft + goals + Audience clusters.

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
- Future: analysis → Editing Copilot plan + Pre-Publish checklist

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

## Explicitly deferred (do not fake)

- Social OAuth, CSV sync, live comment pull
- LLM-powered Idea Gate / Pre-Publish / Editing Copilot / Analyze deep mode
- Canvas, Outliers research feed, multiplayer
- Multi-model completions and usage billing
- `@` reference resolver UI
- Auto-generated roadmap progress from invented metrics
- Embedding generation + hybrid retrieval
- Async job workers

## Deferred functionality (broader product)

- Full My Content insights / Ask My Content / remake finder / weekly report generation
- Research outliers, Canvas, Create/Plan/Performance product surfaces
- Brand Brain training loops
