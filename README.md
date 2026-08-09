# FormCraft

Creator intelligence platform — research, teach, analyze, plan, and write with personal content context.

## This iteration

- Auth + protected app shell
- Teach FormCraft knowledge base (`/knowledge`)
- My Content foundation (`/my-content`)
- Video Breakdown Lab transcript foundation (`/analyze`)

See `IMPLEMENTATION_PLAN.md`, `ARCHITECTURE.md`, and `DATABASE.md`.

## Setup

1. Copy `.env.example` → `.env.local` and fill Supabase keys
2. Apply migrations: `npx supabase db push` (or local `supabase start` + `db reset`)
3. Install & run:

```bash
npm install
npm run dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Next.js server |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
