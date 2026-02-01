# Pluto

A lightweight outreach CRM for managing cold email campaigns with AI-powered research and drafting.

**Core workflow:** Import CSV → Enrich (Exa) → Draft (Claude) → Review/Edit → Send (Gmail) → Track Replies

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) (React, file-based routing, SSR) |
| Runtime | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) via [Drizzle ORM](https://orm.drizzle.team/) |
| Background Jobs | [Cloudflare Queues](https://developers.cloudflare.com/queues/) |
| AI | [Anthropic Claude API](https://docs.anthropic.com/) |
| Research | [Exa API](https://docs.exa.ai/) |
| Email | Gmail API (OAuth2) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (for local D1 and deployment)

### Installation

```bash
# Clone and install dependencies
git clone <repo-url>
cd pluto
pnpm install

# Generate Cloudflare types
pnpm cf-typegen

# Set up local database
pnpm db:migrate
```

### Environment Setup

Create a `.dev.vars` file for local development secrets:

```bash
ANTHROPIC_API_KEY=sk-ant-...
EXA_API_KEY=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
BETTER_AUTH_SECRET=...
ALLOWED_EMAILS=user1@example.com,user2@example.com
```

Note: `ALLOWED_EMAILS` is a comma-separated list of emails permitted to sign up. Leave empty to allow all emails.

For production, set secrets via Wrangler:

```bash
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put EXA_API_KEY
wrangler secret put GMAIL_CLIENT_ID
wrangler secret put GMAIL_CLIENT_SECRET
wrangler secret put BETTER_AUTH_SECRET
```

To restrict signups, update `ALLOWED_EMAILS` in `wrangler.jsonc` or set it as a secret.

### Running Locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Development

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server on port 3000 |
| `pnpm build` | Build for production |
| `pnpm test` | Run Vitest tests |
| `pnpm deploy` | Build and deploy to Cloudflare |
| `pnpm cf-typegen` | Regenerate Cloudflare runtime types |
| `pnpm db:generate` | Generate Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply migrations to local D1 |
| `pnpm db:migrate:prod` | Apply migrations to production D1 |

### Project Structure

```
src/
├── routes/                 # File-based routing (TanStack Router)
│   ├── __root.tsx          # Root layout
│   ├── index.tsx           # Dashboard
│   ├── review.tsx          # Draft review queue
│   ├── contacts/           # Contact management
│   ├── companies/          # Company management
│   └── campaigns/          # Campaign management
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── *.tsx               # App components
├── lib/
│   ├── db/
│   │   ├── schema.ts       # Drizzle schema (all tables)
│   │   └── index.ts        # Database helper
│   ├── server/             # Server functions (createServerFn)
│   ├── queue/
│   │   ├── types.ts        # Job message types
│   │   └── processors.ts   # Queue job handlers
│   ├── env.ts              # Cloudflare env access
│   └── utils.ts            # Utilities (cn, etc.)
├── worker.ts               # Cloudflare Worker entry point
└── router.tsx              # Router configuration
```

### Adding a New Route

Create a file in `src/routes/`. TanStack Router auto-generates route types.

```tsx
// src/routes/example.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/example')({
  component: ExamplePage,
})

function ExamplePage() {
  return <div>Example</div>
}
```

Dynamic routes use `$param` syntax: `src/routes/contacts/$id.tsx`

### Creating Server Functions

Server functions run on Cloudflare Workers. Use `createServerFn` from TanStack Start:

```tsx
// src/lib/server/example.ts
import { createServerFn } from "@tanstack/react-start";
import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/db";

export const getExample = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Query database
    const result = await db.query.examples.findFirst({
      where: eq(examples.id, data.id),
    });

    return result;
  });

export const createExample = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const [created] = await db
      .insert(examples)
      .values({ name: data.name })
      .returning();

    return created;
  });
```

Call from components:

```tsx
// In a route or component
const data = await getExample({ data: { id: "123" } });
```

### Database Schema

Schema is defined in `src/lib/db/schema.ts` using Drizzle ORM.

**Core tables:**
- `products` - Product configurations with prompt templates
- `companies` - Company records with enrichment data
- `contacts` - Contact records linked to companies
- `campaigns` - Campaign configurations
- `campaign_contacts` - Junction table with pipeline state
- `emails` - Email history and tracking
- `activities` - Audit log
- `gmail_tokens` - OAuth token storage

**Modifying the schema:**

1. Edit `src/lib/db/schema.ts`
2. Generate migration: `pnpm db:generate`
3. Apply locally: `pnpm db:migrate`
4. Apply to production: `pnpm db:migrate:prod`

### Campaign Contact Pipeline

Each contact in a campaign moves through stages:

```
new → queued_enrich → enriching → enriched → queued_draft → drafting → drafted → approved → queued_send → sending → sent
                                                                                                                    ↓
                                                                                              replied | bounced | skipped
```

Stage transitions are managed by:
- **UI actions** - User approves/skips drafts
- **Queue processors** - Background jobs for enrichment, drafting, sending

### Background Jobs (Cloudflare Queues)

The worker (`src/worker.ts`) processes queue messages. Job types:

| Type | Purpose | Processor |
|------|---------|-----------|
| `enrich` | Fetch company research via Exa | `processEnrichment` |
| `draft` | Generate email via Claude | `processDrafting` |
| `send` | Send email via Gmail | `processSending` |
| `check_replies` | Poll for email replies | `processReplyCheck` |

Enqueue a job:

```typescript
await env.JOBS_QUEUE.send({
  type: "enrich",
  campaignContactId: cc.id,
  campaignId: campaign.id,
});
```

### Adding UI Components

This project uses [shadcn/ui](https://ui.shadcn.com/). Add components via CLI:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

Components are added to `src/components/ui/`.

**Icons:**
- Primary: `@hugeicons/react` - `import { IconName } from "@hugeicons/react"`
- Secondary: `lucide-react` - `import { IconName } from "lucide-react"`

### Testing

Tests use [Vitest](https://vitest.dev/) with setup in `test/setup.ts`.

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run specific test file
pnpm test src/lib/example.test.ts
```

Test files should be co-located: `example.ts` → `example.test.ts`

## External Services

### Exa API (Research)

Used for company enrichment. See `src/lib/server/enrichment.ts`.

```typescript
// Multi-query enrichment with company info + recent news
const { companyResults, newsResults } = await enrichWithMultiQuery(
  companyName,
  productQuery,
  env.EXA_API_KEY
);
```

### Claude API (Drafting)

Used for email generation. See `src/lib/server/drafting.ts`.

The drafting pipeline:
1. Extract a "hook" from enrichment data
2. Build structured prompt with product context
3. Generate personalized email (<150 words)

### Gmail API

OAuth flow and email sending. See `src/lib/server/gmail*.ts`.

- `gmail-auth.ts` - OAuth token management
- `gmail-api.ts` - Raw Gmail API calls
- `gmail.ts` - High-level send/reply functions

## Deployment

Deploy to Cloudflare:

```bash
pnpm deploy
```

This builds the app and deploys via Wrangler. Ensure production secrets are set first.

### Production Checklist

- [ ] Set all secrets via `wrangler secret put`
- [ ] Run `pnpm db:migrate:prod` for schema changes
- [ ] Verify queue bindings in `wrangler.jsonc`

## Architecture Decisions

**Why TanStack Start?**
- File-based routing with type-safe server functions
- SSR support with Cloudflare Workers compatibility
- Modern React 19 features

**Why Cloudflare D1?**
- SQLite at the edge with zero cold starts
- Integrated with Workers runtime
- Cost-effective for single-user apps

**Why Cloudflare Queues?**
- Reliable background job processing
- Automatic retries with dead-letter queue
- Native Workers integration

**Why separate enrichment → drafting stages?**
- Allows review of research quality before drafting
- Enables batch operations at each stage
- Provides clear audit trail
