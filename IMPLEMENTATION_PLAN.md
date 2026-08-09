# FormCraft Implementation Plan

## Current iteration scope

This repository implements **Phase 0**, **Phase 1**, and **Phase 1B**, plus foundation scaffolding for:

- **My Content** (`/my-content`) — personal content intelligence
- **Video Breakdown Lab** (`/analyze`) — transcript-first analysis lab

Deferred product areas (shell placeholders only): Research feed, Canvas, Create studio, Plan, Performance editorial, Library vault, Brand Brain training, Connections, Models, Usage, Templates, social monitoring APIs, embedding generation, LLM providers.

## Stack

- Next.js App Router (TypeScript strict)
- Tailwind CSS v4 design tokens from FormCraft mockups
- Accessible UI primitives (Radix + shadcn-style components)
- Supabase PostgreSQL, Auth, Storage, pgvector-ready schema
- Zod validation
- Vitest

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

## Acceptance criteria (this iteration)

1. User can register and sign in
2. Protected shell routes work
3. Teach FormCraft CRUD + search + AI toggle + delete
4. Knowledge processing persists extracted text or fails loudly
5. My Content manual posts persist with labelled sources
6. Analyze accepts transcript and persists structured result
7. Typecheck, lint, and unit tests pass
8. No fabricated platform metrics or fake AI/social integrations

## Next phases (not started)

- Social account OAuth + CSV import for My Content
- Full insights engine, Ask My Content, remake finder, weekly report generation
- Video/audio processing, deep LLM breakdown modes, compare mode
- Research outliers, Canvas, generation studio
