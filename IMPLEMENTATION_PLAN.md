# FormCraft Implementation Plan

## Current iteration scope

This repository implements **Phase 0**, **Phase 1**, and **Phase 1B**, plus foundations for:

- **My Content** (`/my-content`) — personal content intelligence
- **Video Breakdown Lab** (`/analyze`) — transcript-first analysis lab
- **Creator Growth & Intelligence** — schema + minimal route scaffolding for Roadmap, Experiments, Audience, Pre-Publish, and Idea Gate (no fake social/LLM integrations)

Deferred product areas (shell placeholders or docs-only): Research feed, Canvas, Create studio, Plan, Performance editorial, Library vault, Brand Brain training, Connections, Models, Usage, Templates, Editing Copilot UI, social monitoring APIs, embedding generation, LLM providers, multi-model workspace, @ references UI, Outliers, multiplayer.

## Personal-use scope (expansion §130)

FormCraft is built **personal-user first**:

- One owner per row (`user_id` + RLS)
- No teams, agencies, shared workspaces, or multiplayer collaboration in this horizon
- Growth systems optimize a single creator’s operating loop, not org reporting
- Future multiplayer/agency features must not reshape the personal schema without an explicit migration plan

## Stack

- Next.js App Router (TypeScript strict)
- Tailwind CSS v4 design tokens from FormCraft mockups
- Accessible UI primitives (Radix + shadcn-style components)
- Supabase PostgreSQL, Auth, Storage, pgvector-ready schema
- Zod validation
- Vitest

## Unified operating loop

Creator Growth turns FormCraft into a closed learning system:

```
Teach (Knowledge)
  → Aim (Roadmap milestones)
  → Gate ideas (Idea Gate)
  → Draft (Create — future)
  → Stress-test (Pre-Publish Lab)
  → Edit plan (Editing Copilot — future)
  → Publish (external / My Content ingest)
  → Break down (Analyze)
  → Measure & learn (My Content lessons)
  → Run controlled tests (Experiment Lab)
  → Mine audience language (Audience Miner)
  → Update Roadmap + Knowledge
  → repeat
```

Every step should eventually feed the context builder with provenance. This iteration only persists manual/heuristic foundations for the new surfaces.

## What’s done vs next

| Area | Status |
|------|--------|
| Auth, shell, Today, Settings/Profile | Done |
| Teach FormCraft (`/knowledge`) | Done (FTS; embeddings deferred) |
| My Content manual posts + lessons tables | Done (manual + connected sync coexist) |
| Analyze transcript heuristics | Done (LLM/visual deferred) |
| Creator growth schema (roadmaps, experiments expand, idea gate, pre-publish, audience, editing_plans) | Done (migration) |
| Roadmap / Experiments / Audience / Pre-Publish / Idea Gate minimal CRUD UI | Scaffolded (manual + heuristic only) |
| **Growth Phase F.5 — Social Connections & Content Sync** | Done |
| **Growth Phase G — Unified Intelligence Layer** | Partial → core done (G1/G1.5 OpenRouter client, context builder, My Content classify, lessons, experiments, Idea Gate, Analyze personal context, Today backlog guard, weekly review). Heuristic fallbacks remain when AI unavailable. |
| **Growth Phase H — Niche Intelligence + Outlier Idea Finder** | Partial → core done (Research modes, YouTube/demo discovery providers, watchlists/creators schema, outlier labels/confidence, For You ranking, on-demand analyze, ideas→Idea Gate, niche brief, multi-outlier synthesis). IG/TikTok niche search not available via official APIs (manual only). Canvas remains stub. |
| Editing Copilot product UI | Deferred (table ready) |
| Canvas / Outliers / multiplayer / new platforms | Deferred |

## Phases

### Phase 0 — Repository and architecture

- Scaffold application
- Document architecture, database, env vars
- Store design reference expectations (tokens in CSS)

### Phase 1 — Application foundation

- Auth (sign-up, sign-in, sign-out, protected routes via `src/proxy.ts`)
- App shell with primary + secondary navigation
- Today landing, settings, profile
- Loading / error / empty states

### Phase 1B — Teach FormCraft

- Knowledge collections, notes, TXT/MD/PDF upload
- Processing pipeline (upload → extract → chunk → ready/failed)
- FTS retrieval interface
- AI context builder stub with provenance
- Demo knowledge items labelled `is_demo`

### Phase 1C foundations (added)

#### My Content (`/my-content`)

- Schema for posts, clusters, performance lessons, experiments, weekly reports
- Manual post entry and historical metric storage (null = unavailable)
- Baseline / relative performance helpers
- Lesson confirm/reject workflow tables
- Connected social ingestion **deferred** (no fake integrations)

#### Video Breakdown Lab (`/analyze`)

- Schema for analyses + saved patterns
- Transcript paste path with persisted structured Zod output
- Honest confidence notes when visual evidence is absent
- URL fetch, transcription, frame sampling, LLM critique **deferred**

### Creator Growth expansion — phases A–K (§131)

These phases sequence the expansion. Only A–D foundations (schema + light UI) are started; later phases remain planned.

| Phase | Focus | This iteration |
|-------|--------|----------------|
| **A** | Roadmap & goals (`creator_roadmaps`, milestones, updates) | Schema + minimal create/list UI |
| **B** | Experiment Lab (expand `content_experiments`) | Additive columns + hypothesis create/list |
| **C** | Idea Gate evaluations | Schema + heuristic paste evaluate |
| **D** | Pre-Publish Lab reviews | Schema + paste → stub review row |
| **E** | Editing Copilot (`editing_plans`) | Schema only; UI deferred |
| **F** | Audience Miner (comments, clusters, language) | Schema + manual comment paste/list |
| **F.5** | Social Connections & Content Sync (owned accounts) | Schema + `/connections` + IG/YT/TT adapters + My Content sync |
| **G** | Unified intelligence layer (context builder + wiring) | Done — heuristics always; OpenRouter when configured |
| **H** | `@` references into context slots | Planned (no fake resolution) |
| **I** | Multi-model workspace (Connections/Models) | Planned; no provider calls |
| **J** | Automate learning loop (lesson → roadmap/experiment suggestions) | Planned; AI-suggested milestones stored as `ai_suggested` only when real |
| **K** | Today / operating cadence (priority from live roadmap + experiments) | Light Today copy only |

## Roadmap product surfaces (planned)

Include in the long-term roadmap (docs + nav foundations where noted):

1. **Roadmap** — goal, phase, progress, milestones (`auto` / `manual` / `ai_suggested`)
2. **Experiments** — hypothesis, variants, metrics, conclusions
3. **Idea Gate** — pursue / reshape / park / kill with evidence
4. **Pre-Publish** — script stress-test before posting
5. **Editing Copilot** — structured edit plans from analyses/scripts
6. **Audience Miner** — comment ingest → clusters → language bank

## Acceptance criteria (this iteration)

1. User can register and sign in
2. Protected shell routes work (including new growth routes)
3. Teach FormCraft CRUD + search + AI toggle + delete
4. Knowledge processing persists extracted text or fails loudly
5. My Content manual posts persist with labelled sources
6. Analyze accepts transcript and persists structured result
7. Growth migration applies; RLS ownership on new tables
8. Roadmap/Experiments/Audience/Pre-Publish/Idea Gate scaffolds persist manual or heuristic rows
9. Typecheck, lint, and unit tests pass
10. No fabricated platform metrics or fake AI/social integrations

## Next phases (not started)

- Social account OAuth + CSV import for My Content / Audience
- Full insights engine, Ask My Content, remake finder, weekly report generation
- Video/audio processing, deep LLM breakdown modes, compare mode
- LLM-backed Idea Gate, Pre-Publish, Editing Copilot
- Research outliers, Canvas, generation studio
- Context builder slots for roadmap, experiments, audience language
- Multi-model workspace + `@` references
