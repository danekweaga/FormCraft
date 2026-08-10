# Production configuration

## Required Vercel environment variables

Set these for Production and Preview as appropriate. Never expose server-only values with a `NEXT_PUBLIC_` prefix.

- `NEXT_PUBLIC_APP_URL` — canonical HTTPS deployment URL.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOCIAL_TOKEN_ENCRYPTION_KEY`
- `SOCIAL_OAUTH_STATE_SECRET`
- `OPENROUTER_API_KEY`
- `DAILY_AI_BUDGET_USD`
- `MONTHLY_AI_BUDGET_USD`
- `CRON_SECRET`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Provider-specific variables:

- Instagram owned account: `META_APP_ID`, `META_APP_SECRET`, optionally `META_GRAPH_API_VERSION` and `INSTAGRAM_LOGIN_CONFIG_ID`.
- TikTok owned account: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
- YouTube niche discovery: `YOUTUBE_DATA_API_KEY`.
- TikTok niche discovery: `TIKTOK_DATA_API_KEY` (separate from Login Kit; optional third-party provider).
- YouTube owned-account OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

Generate independent high-entropy values for `CRON_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Do not reuse OAuth client secrets.

## Redirect URLs

Update provider dashboards after choosing the production domain:

- Instagram: `https://YOUR_DOMAIN/api/social/instagram/callback`
- TikTok: `https://YOUR_DOMAIN/api/social/tiktok/callback`
- YouTube: `https://YOUR_DOMAIN/api/social/youtube/callback`

Exact scheme, host, port, path, and trailing-slash behavior must match the provider configuration.

## Database

Run from the linked repository:

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

The `20260810170000_complete_growth_l_m_product_systems.sql` migration is applied to the linked project as of 2026-08-10.

## Scheduled routes

`vercel.json` configures:

- `/api/cron/research-scan`
- `/api/cron/watchlist-scan`
- `/api/cron/owned-social-sync`
- `/api/cron/weekly-review`

Each route rejects requests unless the `Authorization` header matches `Bearer ${CRON_SECRET}`. Provider budgets and per-run limits prevent unbounded scans.

## Release check

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

After deployment, sign in and verify Creator Profile, Creators → Import all into scan, Discover → Watchlists → Refresh, Create My Version, Psychology starter installation, Usage/Data Health, and each owned social connection.
