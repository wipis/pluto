# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pluto is a lightweight outreach CRM for managing cold email campaigns with AI-powered research and drafting. Multi-user app with invite-only signup (first user becomes admin).

**Core flow:** Import CSV → Enrich (Exa) → Draft (Claude) → Review/Edit → Send (Gmail) → Track Replies

## Development Commands

```bash
pnpm dev              # Start dev server on port 3000
pnpm build            # Build for production
pnpm test             # Run all Vitest tests
pnpm test -- src/lib/example.test.ts  # Run a single test file
pnpm deploy           # Build and deploy to Cloudflare
pnpm cf-typegen       # Generate Cloudflare runtime types
pnpm db:generate      # Generate Drizzle migrations after schema change
pnpm db:migrate       # Run D1 migrations locally
pnpm db:migrate:prod  # Run D1 migrations on production
```

**Schema change workflow:** Edit `src/lib/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`

## Architecture

### Framework: TanStack Start + Cloudflare Workers

Routes are file-based in `src/routes/`. Dynamic routes use `$param` syntax (e.g., `contacts/$id.tsx`).

### Dual-Mode Worker

`src/worker.ts` is the Cloudflare Worker entry point. It exports both:
- `fetch` handler (TanStack Start HTTP) for serving the app
- `queue` handler for background job processing via Cloudflare Queues

### Server Functions

All server functions live in `src/lib/server/` and follow this pattern:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/db";

export const getData = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();  // Always use getEnv(), never direct env access
    const db = getDb(env.DB);
    // ...
  });
```

- Input validators are simple pass-through: `(data: Type) => data`
- Optional input uses `(data?: {}) => data ?? {}`
- Return raw data, not Response objects

### Database: D1 + Drizzle ORM

Schema in `src/lib/db/schema.ts`. Access via `getDb(env.DB)`.

**Core tables:** `products`, `companies`, `contacts`, `campaigns`, `campaign_contacts`, `emails`, `activities`, `gmail_tokens`, `invites`

**ID generation:** All tables use `nanoid()` for primary keys.

**Timestamps:** All tables use `integer("...", { mode: "timestamp" })` with `$defaultFn(() => new Date())`.

**JSON fields:** Several columns store JSON as `text()` — `enrichmentData`, `tags`, `metadata`, `fewShotExamples`, `antiPatterns`, `painPoints`, `valueProps`. Parse with `JSON.parse()`, stringify before storing.

### Campaign Contact State Machine

```
new → queued_enrich → enriching → enriched → queued_draft → drafting → drafted → approved → queued_send → sending → sent → replied | bounced | skipped
```

Key design: Intermediate "queued" stages prevent re-processing. On failure, processors revert to the previous stable state (e.g., enrichment failure → `new`, not `queued_enrich`).

### Background Jobs (Cloudflare Queues)

Job types in `src/lib/queue/types.ts`, processors in `src/lib/queue/processors.ts`, producers in `src/lib/queue/producers.ts`.

**Producer pattern:** Batch update to queued stage → enqueue all jobs via `sendBatch`. Send jobs use `delaySeconds: index * 60` for rate limiting (1 email/minute).

**Processor pattern:** Jobs use `message.ack()` on success and `message.retry()` on retryable failure. Non-retryable errors (e.g., missing data) are acked to prevent infinite retries.

### Two-Step AI Drafting

`src/lib/server/drafting.ts` calls Claude **twice** per email:
1. **Hook extraction** — analyzes enrichment data, returns `{ hook, angle, proofPoint }`
2. **Email generation** — uses the hook + product config (system prompt, few-shot examples, anti-patterns) to generate a personalized email

### Multi-Account Gmail

`src/lib/server/gmail-auth.ts` supports multiple Gmail accounts. Campaigns select which account to send from via `campaign.gmailAccountId`. Token refresh is transparent with a 5-minute expiry buffer.

### Authentication & Invites

Better Auth with Drizzle adapter (`src/lib/auth/index.ts`). First user to sign up becomes admin (`role: "admin"`). Subsequent signups require an invite — admin creates invites from Settings, generating a `/signup?token=xxx` link. Users table has a `role` field (`"admin"` | `"member"`). Invite server functions in `src/lib/server/invites.ts`.

Route protection in `__root.tsx` via `beforeLoad` — redirects to `/login` if no session. Auth API handled by catch-all route at `src/routes/api/auth/$.ts`.

## Key Patterns

**Path aliases:** `@/*` maps to `src/*`

**Environment access:** Always use `getEnv()` from `@/lib/env` — wraps `cloudflare:workers` env import

**Activity logging:** Most mutations should log to `activities` table with an activity type (e.g., `enrichment_completed`, `draft_approved`, `email_sent`)

**Enrichment scoring:** `enrichmentScore` (0-10) on campaign_contacts rates research quality based on keyword matches and content richness

**Icons:** Primary: HugeIcons (`@hugeicons/react`), Secondary: Lucide React (`lucide-react`)

**UI components:** shadcn/ui in `src/components/ui/`, add via `npx shadcn@latest add <component>`

**Testing:** Vitest with co-located test files (`example.ts` → `example.test.ts`). Test setup in `test/setup.ts` mocks `globalThis.env` and `fetch`.

## External Integrations

| Service | Purpose | Key Files |
|---------|---------|-----------|
| Exa API | Company enrichment (multi-query) | `src/lib/server/enrichment.ts` |
| Claude API | Hook extraction + email drafting | `src/lib/server/drafting.ts` |
| Gmail API | OAuth, send, reply tracking | `src/lib/server/gmail-auth.ts`, `gmail-api.ts`, `gmail.ts` |

## Environment Variables

Required secrets (set via `wrangler secret`):
- `ANTHROPIC_API_KEY`, `EXA_API_KEY`
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`

Bindings: `DB` (D1 database), `JOBS_QUEUE` (Cloudflare Queue)
