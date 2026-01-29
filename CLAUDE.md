# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pluto is a lightweight outreach CRM for managing cold email campaigns with AI-powered research and drafting. Single-user app protected by Cloudflare Access.

**Core flow:** Import CSV → Enrich (Exa) → Draft (Claude) → Review/Edit → Send (Gmail) → Track Replies

**Products supported:**
- `file-logic` - HIPAA document processing for SS disability law firms
- `consulting` - Design engineering services for startups/agencies
- `offerarc` - AI ad generation for media buyers

## Development Commands

```bash
pnpm dev          # Start dev server on port 3000
pnpm build        # Build for production
pnpm test         # Run Vitest tests
pnpm deploy       # Build and deploy to Cloudflare Pages
pnpm cf-typegen   # Generate Cloudflare runtime types
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run D1 migrations
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (file-based routing, SSR) |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Auth | Cloudflare Access (zero config in app) |
| AI | Anthropic Claude API |
| Research | Exa API |
| Email | Gmail API (OAuth2) |
| Styling | Tailwind CSS v4 + shadcn/ui |

## Source Structure

```
src/
├── routes/              # File-based routing (TanStack Router)
│   ├── __root.tsx       # Root layout with Header
│   ├── index.tsx        # Dashboard with stats
│   ├── review.tsx       # Draft review queue (split panel UI)
│   ├── contacts/
│   │   ├── index.tsx    # Contact list
│   │   ├── $id.tsx      # Contact detail
│   │   ├── new.tsx      # Add contact form
│   │   └── import.tsx   # CSV import with column mapping
│   ├── companies/
│   │   ├── index.tsx    # Company cards
│   │   └── $id.tsx      # Company detail with enrichment
│   └── campaigns/
│       ├── index.tsx    # Campaign cards with counts
│       ├── new.tsx      # Create campaign form
│       └── $id.tsx      # Campaign detail with pipeline view
├── components/
│   ├── Header.tsx       # Navigation header
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── server/          # Server functions (createServerFn)
│   │   ├── contacts.ts  # Contact CRUD
│   │   ├── companies.ts # Company CRUD
│   │   ├── campaigns.ts # Campaign CRUD + add contacts
│   │   ├── import.ts    # CSV import
│   │   ├── enrichment.ts # Exa API integration
│   │   ├── drafting.ts  # Claude API integration
│   │   ├── gmail.ts     # Gmail send/reply check
│   │   ├── review.ts    # Review queue operations
│   │   └── stats.ts     # Dashboard stats
│   ├── db/
│   │   ├── schema.ts    # Drizzle schema (6 tables)
│   │   └── index.ts     # getDb helper
│   ├── products.ts      # Product configs
│   └── utils.ts         # cn() classname utility
└── router.tsx
```

## Database Schema

**Core tables:** `companies`, `contacts`, `campaigns`, `campaign_contacts`, `emails`, `activities`

**Campaign contact stages:** `new` → `enriching` → `enriched` → `drafting` → `drafted` → `approved` → `sending` → `sent` → `replied` | `bounced` | `skipped`

**Activity types:** `contact_created`, `contact_updated`, `added_to_campaign`, `enrichment_started`, `enrichment_completed`, `draft_created`, `draft_approved`, `draft_rejected`, `email_sent`, `email_opened`, `email_replied`, `note_added`

## Key Patterns

**Server Functions**: Use `createServerFn` from `@tanstack/react-start`:
```typescript
const getContacts = createServerFn({ method: 'GET' }).handler(async () => {
  // Access D1 via env bindings
})
```

**Product Context**: Each product in `src/lib/products.ts` defines:
- `name`, `description`, `valueProps`, `targetAudience`
- `enrichmentQuery(companyName)` - Exa search query generator

**Path Aliases**: Use `@/*` to import from `src/*`

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
EXA_API_KEY=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_FROM_EMAIL=you@example.com
```

D1 database binding: `DB` (configured in wrangler.jsonc)

## External Integrations

**Exa**: Company enrichment via `searchAndContents` with neural search. Product-specific queries for targeted research.

**Claude**: Email drafting with system prompt for concise, personalized cold emails (<150 words). Supports regeneration with feedback.

**Gmail**: Send via `users.messages.send`, track replies by checking thread message count.

## Icons

- Primary: HugeIcons (`@hugeicons/react`)
- Secondary: Lucide React (`lucide-react`)
