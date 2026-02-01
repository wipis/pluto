# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pluto is a lightweight outreach CRM for managing cold email campaigns with AI-powered research and drafting. Single-user app protected by Cloudflare Access.

**Core flow:** Import CSV → Enrich (Exa) → Draft (Claude) → Review/Edit → Send (Gmail) → Track Replies

## Development Commands

```bash
pnpm dev              # Start dev server on port 3000
pnpm build            # Build for production
pnpm test             # Run all Vitest tests
pnpm deploy           # Build and deploy to Cloudflare Pages
pnpm cf-typegen       # Generate Cloudflare runtime types
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run D1 migrations locally
pnpm db:migrate:prod  # Run D1 migrations on production
```

## Architecture

### Framework: TanStack Start + Cloudflare Workers

Routes are file-based in `src/routes/`. Server functions use `createServerFn` from `@tanstack/react-start`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/db";

export const getData = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();  // Access Cloudflare bindings
    const db = getDb(env.DB);
    // ...
  });
```

### Background Jobs: Cloudflare Queues

The worker (`src/worker.ts`) handles both HTTP requests (via TanStack Start) and queue processing. Job types defined in `src/lib/queue/types.ts`:
- `enrich` - Exa API company research
- `draft` - Claude email generation
- `send` - Gmail delivery
- `check_replies` - Poll for responses

Processors in `src/lib/queue/processors.ts` implement state machine transitions for `campaign_contacts.stage`.

### Database: D1 + Drizzle ORM

Schema in `src/lib/db/schema.ts`. Access via `getDb(env.DB)`.

**Core tables:** `products`, `companies`, `contacts`, `campaigns`, `campaign_contacts`, `emails`, `activities`, `gmail_tokens`

**Campaign contact stages (state machine):**
```
new → queued_enrich → enriching → enriched → queued_draft → drafting → drafted → approved → queued_send → sending → sent → replied | bounced | skipped
```

### Products (Dynamic Configuration)

Products are stored in the database with fields for prompt engineering:
- `enrichmentQueryTemplate` - Exa search template with `{{companyName}}` placeholder
- `emailSystemPrompt` - Claude system prompt for email drafting
- `fewShotExamples`, `antiPatterns`, `painPoints` - Advanced prompt tuning (JSON)

## Key Patterns

**Path aliases:** Use `@/*` to import from `src/*`

**Environment access:** Always use `getEnv()` from `@/lib/env` to access Cloudflare bindings

**JSON fields:** Several columns store JSON as text (`enrichmentData`, `tags`, `metadata`). Parse with `JSON.parse()`, stringify before storing.

**Activity logging:** Most mutations should log to `activities` table for audit trail

## External Integrations

| Service | Purpose | Key Location |
|---------|---------|--------------|
| Exa API | Company enrichment | `src/lib/server/enrichment.ts` |
| Claude API | Email drafting, hook extraction | `src/lib/server/drafting.ts` |
| Gmail API | OAuth, send, reply tracking | `src/lib/server/gmail*.ts` |

## Environment Variables

Required secrets (set via `wrangler secret`):
- `ANTHROPIC_API_KEY` - Claude API
- `EXA_API_KEY` - Exa research API
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` - OAuth credentials
- `BETTER_AUTH_SECRET` - Session encryption key

Configuration (set in `wrangler.jsonc` vars or `.dev.vars`):
- `ALLOWED_EMAILS` - Comma-separated list of emails permitted to sign up (empty = allow all)

D1 binding: `DB` (configured in `wrangler.jsonc`)
Queue binding: `JOBS_QUEUE`

## Icons

- Primary: HugeIcons (`@hugeicons/react`)
- Secondary: Lucide React (`lucide-react`)
