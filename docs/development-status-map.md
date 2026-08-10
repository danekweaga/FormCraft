# FormCraft development status map

Updated: 2026-08-10

This map describes behavior in the repository, not historical phase labels. “Complete” means a real persisted workflow exists and is covered by build/tests. “Blocked” means the code path exists but the configured provider cannot supply the required data.

## Complete

- Growth G core: OpenRouter structured generation, per-task model routing, creator-context builder, usage events, budget checks, result cache, retries, and deterministic fallbacks.
- Growth I core: URL/upload/transcript video analysis, evidence-aware result schema, comparisons, saved patterns, and Canvas lineage.
- Growth J core: Idea Gate, Pre-Publish review, editing directions, packaging, and Research → Spin → Idea → Script → Pre-Publish progression.
- Growth K: multi-node Canvas, typed nodes/edges, templates, AI transforms, persistence, and provenance links.
- Creator profile: What I Make, My Audience, My Content Style, and My Script Style feed the shared AI context.
- Product shell: Today, Discover, Build, Analyze, My Content, and Library are the primary mental model. Advanced tools remain available through grouped secondary navigation and global search/commands.

## Partial

- Growth H: official YouTube discovery, creator-relative outlier scoring, watchlists, recurring scans, TikTok third-party adapter, manual references, creator comparison, and Create My Version work. TikTok pulls require `TIKTOK_DATA_API_KEY`; public Instagram competitor-feed pulling is not available through Meta's official owned-account API.
- Growth L: evidence-based remake, follow-up, comment-response, carousel, social-post, research-to-script, series planning, and series status tracking work. Podcast clip extraction and a dedicated voice-note transcription-to-script surface remain dependent on suitable media/transcription input; Canvas and Analyze can retain those sources without inventing an extraction.
- Growth M: automatic owned-account sync routes, watchlist refresh, weekly review, notification center, Data Health, usage dashboards, caching, retry/idempotency, and Vercel cron definitions exist. Scheduled execution requires production environment variables and the platform cron service.

## Heuristic only

- Outlier detection is deterministic and evidence-backed: views divided by a creator median when at least three creator posts are available; otherwise a niche-cohort median is labeled as such.
- Repurposing decisions use personal baseline/winner evidence and can return Not Worth Repurposing. They do not claim causation.
- Format normalization and some initial post classification are heuristic/AI-assisted and can be manually corrected and locked.
- Psychology content applications are explicitly labeled as FormCraft inferences from cited general evidence, not direct social-video findings.

## Blocked by credentials or provider policy

- TikTok niche-creator pulls: `TIKTOK_DATA_API_KEY` is not currently configured. Login Kit credentials only authorize the user's own account and do not provide competitor discovery.
- Instagram competitor-feed scans: Meta's official Instagram API supports connected professional accounts, not arbitrary competitor scraping. Public Reel URLs remain a manual-reference input.
- Automatic cron execution: requires `CRON_SECRET` in Vercel.
- Stable cross-instance Server Actions: production should set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

## Missing or intentionally deferred

- Multiplayer Canvas.
- Posting, scheduling, or auto-publishing.
- Paywall bypasses or unauthorized paper/book downloading.
- Automatic repurposing of every post.
- Fake metrics, fake competitor data, or fabricated psychology certainty scores.

## Core workflow

1. Complete Creator Profile.
2. Import the supplied creator roster into “Niche creator scan.”
3. Discover refreshes supported channels and retains only short-form posts published in the last 30 days.
4. FormCraft scores videos against creator medians where enough samples exist.
5. Open a video, save/break it down, or choose Create My Version.
6. Enter a personal spin; FormCraft develops and gates the idea, generates a script, and preserves Canvas lineage.
7. Pre-Publish and Editing Copilot improve the draft and packaging.
8. Connected owned-account sync imports published performance.
9. Performance, audience, experiments, weekly review, Today, and repurposing use the resulting evidence.
