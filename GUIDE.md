# Pluto Usage Guide

Pluto is a lightweight outreach CRM for managing cold email campaigns with AI-powered research and drafting.

**Core flow:** Import CSV → Enrich → Draft → Review/Edit → Send → Track Replies

---

## Table of Contents

- [Getting Started](#getting-started)
- [Dashboard](#dashboard)
- [Products](#products)
- [Contacts](#contacts)
- [Companies](#companies)
- [Campaigns](#campaigns)
- [Email Review & Drafting](#email-review--drafting)
- [Sending & Tracking](#sending--tracking)
- [Gmail Integration](#gmail-integration)
- [Team Management](#team-management)
- [Settings](#settings)
- [Quick Start Example](#quick-start-example)
- [Tips & Best Practices](#tips--best-practices)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### First User (Admin)

The first person to sign up becomes the admin. Navigate to `/signup` and create your account with name, email, and password (minimum 8 characters). No invite is needed.

### Joining as a Team Member

All subsequent signups require an invite link from an admin. The link looks like `/signup?token=xxxxx` and expires after 7 days. Your email will be pre-filled from the invite.

### Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access including team management, invites, and member removal |
| **Member** | Full access to contacts, campaigns, products, Gmail, and sending |

---

## Dashboard

The home page shows an overview of your CRM:

- **Stats cards** — Total contacts, companies, active campaigns, and pending review count
- **Weekly stats** — Emails sent and replies received this week
- **Pipeline overview** — Contact stage breakdown across all campaigns
- **Recent campaigns** — 5 most recent campaigns with status and reply counts
- **Recent activity** — Latest 10 events (contact creation, enrichment, drafting, sending, etc.)

Click any stat card to jump to its corresponding page.

---

## Products

Products define what you're selling and guide AI email generation. Manage them at `/products`.

### Creating a Product

Go to `/products/new` and fill in:

| Field | Description | Required |
|-------|-------------|----------|
| **Product Name** | Display name | Yes |
| **Description** | What the product does | Yes |
| **Target Audience** | Who it's for | Yes |
| **Value Propositions** | List of key benefits (click "Add Value Prop" for multiple) | Yes |
| **Enrichment Query Template** | Search template for research — use `{{companyName}}` as a placeholder | No |
| **Email System Prompt** | Instructions for Claude when drafting emails (tone, focus areas, messaging) | Yes |

### Example Enrichment Query

```
{{companyName}} legal tech cloud solutions
```

### Example System Prompt

```
You're selling to busy lawyers. Be concise, professional, and focus on time savings.
Avoid jargon. Lead with a specific observation about their firm.
```

---

## Contacts

Manage individual people you're reaching out to at `/contacts`.

### Adding Contacts Manually

Go to `/contacts/new` and fill in:

- **Email** (required, must be unique)
- First Name, Last Name, Title, Phone, LinkedIn URL, Notes (all optional)

### Importing via CSV

Go to `/contacts/import`:

1. Upload a CSV file
2. Map your CSV columns to Pluto fields
3. Preview the first 5 rows
4. Optionally add imported contacts directly to an existing campaign
5. Review results (created/skipped counts and any errors)

**Supported CSV fields:**

| Field | Required |
|-------|----------|
| Email | Yes |
| First Name | No |
| Last Name | No |
| Company | No |
| Domain | No |
| Job Title | No |
| LinkedIn URL | No |
| Phone | No |

Column names are auto-detected (e.g., "Company Name" maps to Company).

**Example CSV:**
```csv
Email,First Name,Last Name,Company,Title
john@acme.com,John,Smith,ACME Corp,CEO
jane@techcorp.com,Jane,Doe,Tech Corp,VP Sales
```

### Contact Details

Click any contact to view:
- Contact information (editable)
- Linked company
- Activity timeline
- Campaign memberships with stage badges
- Email history (subject, direction, dates)

---

## Companies

Companies are auto-created during contact import based on company name, domain, or email domain. View them at `/companies`.

### Enriching a Company

1. Open a company detail page
2. Click **Enrich with Exa**
3. The system researches the company using the Exa API
4. Results display with links and highlighted snippets
5. Re-enrich anytime to refresh data

---

## Campaigns

Campaigns are the core workflow unit. Manage them at `/campaigns`.

### Creating a Campaign

Go to `/campaigns/new`:

| Field | Description | Required |
|-------|-------------|----------|
| **Campaign Name** | Internal identifier | Yes |
| **Product** | Which product this campaign promotes | Yes |
| **Send From** | Gmail account to send from | Yes (if Gmail connected) |
| **Description** | Internal notes | No |
| **Custom Prompt** | Additional AI drafting instructions | No |

### Campaign Detail Page

The detail page (`/campaigns/$id`) has:

**Action bar** with buttons for each workflow step:

| Button | What it does |
|--------|-------------|
| **Add Contacts** | Select contacts to add to this campaign |
| **Enrich All** | Queue enrichment for all "new" contacts |
| **Draft All** | Generate email drafts for all "enriched" contacts |
| **Review Drafts** | Jump to the review queue |
| **Send Approved** | Send all approved emails (~1 per minute) |

**Pipeline view** — Kanban-style columns showing contacts at each stage.

### Contact Pipeline Stages

```
new → queued_enrich → enriching → enriched → queued_draft → drafting → drafted → approved → queued_send → sending → sent → replied | bounced | skipped
```

| Stage | Meaning |
|-------|---------|
| **new** | Just added, awaiting enrichment |
| **enriching** | Research in progress via Exa |
| **enriched** | Research complete, ready for drafting |
| **drafting** | AI is generating the email |
| **drafted** | Draft ready for review |
| **approved** | Approved, ready to send |
| **sending** | Email being sent |
| **sent** | Successfully delivered |
| **replied** | Prospect replied |
| **bounced** | Email bounced |
| **skipped** | Rejected during review |

Intermediate "queued" stages (queued_enrich, queued_draft, queued_send) prevent duplicate processing. If enrichment or drafting fails, the contact reverts to the previous stable state.

---

## Email Review & Drafting

### How AI Drafting Works

Pluto uses a two-step process for each email:

1. **Hook extraction** — Claude analyzes the enrichment data and identifies a compelling hook, angle, and proof point
2. **Email generation** — Claude uses the hook plus your product's system prompt to write a personalized email

### Reviewing Drafts

Go to `/review` or click **Review Drafts** from a campaign:

**Left panel** — Queue of all contacts with drafted emails

**Right panel** — Draft editor showing:
- Contact name, email, and company
- Navigation arrows and progress indicator (e.g., "3/15")
- **Research context** (collapsible) — Top web search results from enrichment
- **Editable subject line and body** — Make changes before approving
- **Regenerate** — Optional feedback field + regenerate button to rewrite the draft

### Review Actions

| Button | Effect |
|--------|--------|
| **Skip** | Reject the draft, mark contact as "skipped", move to next |
| **Approve** | Approve the draft for later sending |
| **Approve & Send** | Approve and immediately queue for sending |

### Regenerating a Draft

If the draft isn't quite right:

1. Enter feedback in the text area (e.g., "Make it shorter", "Focus more on ROI", "Add a call-to-action")
2. Click **Regenerate**
3. Claude rewrites the email using your feedback
4. Review the new version

---

## Sending & Tracking

### Sending Emails

**Batch sending** from the campaign detail page:
1. Click **Send Approved**
2. All approved contacts are queued
3. Emails send at ~1 per minute to avoid spam flags
4. Progress indicator shows estimated time remaining

**Individual sending** from the review queue:
- Click **Approve & Send** to approve and immediately queue a single email

### Reply Tracking

Replies are automatically detected via the Gmail API:
- Contact stage updates to "replied"
- Activity is logged
- View reply history on the contact detail page

---

## Gmail Integration

### Connecting Gmail

1. Go to **Settings**
2. Click **Connect Gmail**
3. Complete the Google OAuth consent flow
4. You're redirected back to Settings with a success notification

### Multiple Accounts

- Click **Connect Another Account** to add more Gmail accounts
- Label accounts (e.g., "Work Gmail", "Sales Gmail") using the edit button
- Remove accounts with the delete button
- Select which account to send from when creating a campaign

Token refresh is automatic — no manual management needed.

---

## Team Management

Admin-only features available at **Settings > Team**.

### Inviting Members

1. Enter the team member's email
2. Click **Invite**
3. Copy the generated invite link and send it to them
4. Link expires after 7 days

### Managing Members

- View all team members with name, email, and role
- Remove members with the delete button (admins cannot remove themselves)
- Revoke pending invites before they're used

---

## Settings

Available at `/settings`:

- **Gmail Accounts** — Connect, label, and manage Gmail accounts
- **Team** (admin only) — Invite and manage team members
- **Environment info** — Required API keys and configuration

---

## Quick Start Example

Here's how to run your first campaign end-to-end:

### 1. Create a Product

```
Name:              Legal Tech Solution
Description:       Cloud-based contract management for law firms
Target Audience:   Legal practice managers
Value Props:       50% faster contract review, Automated compliance checks
Enrichment Query:  {{companyName}} legal technology solutions
Email Prompt:      You're selling to busy lawyers. Be concise and focus on time savings.
```

### 2. Connect Gmail

Go to Settings → Connect Gmail → Complete OAuth flow.

### 3. Import Contacts

Go to Contacts → Import → Upload your CSV → Map columns → Optionally add to a campaign.

### 4. Create a Campaign

```
Name:      Law Firm Outreach Q1
Product:   Legal Tech Solution
Send From: your-email@gmail.com
```

### 5. Run the Pipeline

1. **Enrich All** — Research each company via Exa
2. **Draft All** — Generate personalized emails via Claude
3. **Review Drafts** — Edit, regenerate, approve, or skip each draft
4. **Send Approved** — Send emails at ~1 per minute

### 6. Monitor Results

Check the dashboard for replies, bounces, and activity. View individual contact pages for full email history.

---

## Tips & Best Practices

**Product setup:**
- Make enrichment queries specific: `{{companyName}} SaaS platform features` is better than just `{{companyName}}`
- Include tone guidance and anti-patterns in your system prompt

**Drafting:**
- Always review auto-generated emails before sending
- Use regenerate with specific feedback for better results
- Common feedback: "Shorter", "More formal", "Add a CTA", "Mention their recent funding"

**Sending:**
- Start with a small batch (10-20 contacts) to test quality
- Monitor for bounces and adjust your contact list
- The 1 email/minute throttle helps prevent spam flags

**Team:**
- Invite team members early so everyone can contribute
- Each member can manage different campaigns independently

---

## Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Contact import errors | Missing or malformed email addresses | Ensure every row has a valid email |
| Duplicates skipped on import | Email already exists in the system | Expected behavior — existing contacts aren't overwritten |
| Enrichment failing | `EXA_API_KEY` not configured or company name too generic | Check environment variables; adjust enrichment query template |
| Drafts not generating | `ANTHROPIC_API_KEY` not configured | Check environment variables; ensure product has a system prompt |
| Gmail not connecting | OAuth credentials not configured | Verify `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` are set |
| Emails not sending | No Gmail account selected for campaign | Connect Gmail in Settings, then set "Send From" on the campaign |
| Stuck in "queued" state | Background worker issue | Check Cloudflare Queue health; contacts will retry automatically |
