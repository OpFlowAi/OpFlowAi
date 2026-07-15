# OpsFlow AI

The operational hub for gas station, truck stop, and grocery store chains — real-time
inventory, staffing, banking visibility, compliance, and an AI agent that can act on your
behalf (with confirmation) across every location.

## Stack

- **Next.js 15** (App Router) + TypeScript, Tailwind v4
- **PostgreSQL** + **Prisma 6**
- **Auth.js (NextAuth v5)** - credentials-based, admin-provisioned (no public signup)
- **Anthropic SDK** - the AI Agent, with persisted conversations and confirmation-gated actions
- **Plaid**, **QuickBooks (Intuit OAuth)**, **Google Sheets API** - real integrations (see below)

## Getting started

1. Copy `.env.example` to `.env` and fill in real values (a working `DATABASE_URL` and
   `AUTH_SECRET` are enough to run the app; integration keys are optional until you wire
   up that provider).
2. Install dependencies and set up the database:

   ```bash
   npm install
   npm run db:push     # create tables from prisma/schema.prisma
   npm run db:seed      # load a realistic demo chain (3 locations, staff, inventory, etc.)
   npm run dev
   ```

3. Sign in with one of the seeded accounts (see `prisma/seed.ts` for the full list):
   - `owner@lonestargroup.com` / `OpsFlow2026!` (account owner, all locations)
   - `manager.northgate@lonestargroup.com` / `OpsFlow2026!` (manager, one location)
   - `admin@opsflow.ai` / `OpsFlow2026!` (OpsFlow platform admin)

## Architecture notes

- **Everything is location-aware.** `src/lib/active-location.ts` resolves the active
  location from a cookie (validated against the signed-in user's access) on every
  server-rendered page; `src/store/location-store.ts` mirrors it client-side. Switching
  locations in the top bar updates the cookie and calls `router.refresh()`, so every
  screen re-renders scoped to the new location.
- **Auth is admin-provisioned.** There is no public signup route. Accounts/users are
  created directly (via `prisma/seed.ts` today, or a future internal admin tool) with
  explicit per-location access grants (`LocationAccess`). Billing/subscription
  management is intentionally out of scope for the app - that lives on the marketing site.
- **Server Actions over API routes where possible.** Mutations like inventory reorder
  decisions use Next.js Server Actions (`src/server/actions/*`) so screens stay simple
  server components; API routes exist where a client needs to poll/mutate outside a form
  (the AI Agent chat, the location switcher).
- **Services layer.** `src/server/services/*` holds all Prisma queries/mutations,
  shared between page Server Components, API routes, and the AI Agent's tools - so the
  agent always reads and writes through the exact same logic the UI does.
- **The AI Agent** (`src/lib/agent/*`) uses real Anthropic tool use: read tools execute
  immediately; write tools (`add_task`, `log_time_off`, `mark_item_reordered`) resolve
  and validate their target (e.g. fuzzy-matching a staff member's name) but only ever
  *propose* a change. Nothing mutates until the user clicks Confirm, which hits
  `POST /api/agent/actions/[id]/decide`. Conversations and every message (including tool
  calls/results) persist in Postgres, so follow-up questions keep full context.

## Integrations

Real credentials are required for each to go live; without them the relevant screen
degrades gracefully (e.g. Banking shows "not connected" instead of erroring):

- **Plaid** - `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV`
- **QuickBooks** - `QUICKBOOKS_CLIENT_ID` / `QUICKBOOKS_CLIENT_SECRET`
- **Google Sheets** - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- **AI Agent** - `ANTHROPIC_API_KEY`

Secrets for connected integrations (OAuth tokens) are encrypted at rest
(`src/lib/crypto.ts`, AES-256-GCM keyed from `AUTH_SECRET`) before being stored.
