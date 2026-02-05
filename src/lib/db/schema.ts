import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";

// Products table
export const products = sqliteTable("products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  valueProps: text("value_props").notNull(), // JSON array
  targetAudience: text("target_audience").notNull(),
  enrichmentQueryTemplate: text("enrichment_query_template").notNull(), // "{{companyName}} law firm..."
  emailSystemPrompt: text("email_system_prompt").notNull(),
  // Advanced prompt engineering fields
  fewShotExamples: text("few_shot_examples"), // JSON array of { context, hook, subject, body }
  antiPatterns: text("anti_patterns"), // JSON array of phrases to avoid
  painPoints: text("pain_points"), // JSON array of customer pain points
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Companies table
export const companies = sqliteTable(
  "companies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    name: text("name").notNull(),
    domain: text("domain"),
    enrichmentData: text("enrichment_data"), // JSON string from Exa
    enrichedAt: integer("enriched_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("companies_domain_idx").on(table.domain)]
);

// Contacts table
export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    companyId: text("company_id").references(() => companies.id),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email").notNull().unique(),
    title: text("title"),
    linkedinUrl: text("linkedin_url"),
    phone: text("phone"),
    notes: text("notes"),
    tags: text("tags"), // JSON array
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("contacts_email_idx").on(table.email),
    index("contacts_company_idx").on(table.companyId),
  ]
);

// Campaigns table
export const campaigns = sqliteTable("campaigns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  product: text("product").notNull(), // 'file-logic' | 'consulting' | 'offerarc'
  description: text("description"),
  templatePrompt: text("template_prompt"), // Custom instructions for Claude
  status: text("status").notNull().default("draft"), // draft | active | paused | completed
  gmailAccountId: text("gmail_account_id"), // Which Gmail account to send from
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Campaign contacts junction table with pipeline state
export const campaignContacts = sqliteTable(
  "campaign_contacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().default("new"), // new | enriching | enriched | drafting | drafted | approved | sending | sent | replied | bounced | skipped
    enrichmentData: text("enrichment_data"), // Contact-specific Exa research JSON
    draftSubject: text("draft_subject"),
    draftBody: text("draft_body"),
    finalSubject: text("final_subject"),
    finalBody: text("final_body"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    openedAt: integer("opened_at", { mode: "timestamp" }),
    repliedAt: integer("replied_at", { mode: "timestamp" }),
    // Drafting improvements
    regenerationCount: integer("regeneration_count").notNull().default(0),
    lastFeedback: text("last_feedback"),
    hookUsed: text("hook_used"),
    enrichmentScore: integer("enrichment_score"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("campaign_contacts_campaign_idx").on(table.campaignId),
    index("campaign_contacts_contact_idx").on(table.contactId),
    index("campaign_contacts_stage_idx").on(table.stage),
  ]
);

// Emails table for full email history
export const emails = sqliteTable(
  "emails",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    threadId: text("thread_id"), // Gmail thread ID
    messageId: text("message_id"), // Gmail message ID
    direction: text("direction").notNull(), // 'outbound' | 'inbound'
    subject: text("subject"),
    body: text("body"),
    status: text("status").notNull().default("draft"), // draft | sent | delivered | opened | replied | bounced
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("emails_contact_idx").on(table.contactId),
    index("emails_thread_idx").on(table.threadId),
  ]
);

// Gmail OAuth tokens (supports multiple accounts)
export const gmailTokens = sqliteTable(
  "gmail_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userEmail: text("user_email").notNull(), // No longer unique - allows reconnecting
    label: text("label"), // Optional display name like "Work Gmail"
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    tokenType: text("token_type").notNull().default("Bearer"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    scope: text("scope"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("gmail_tokens_email_idx").on(table.userEmail)]
);

// Activities for audit trail
export const activities = sqliteTable(
  "activities",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(), // contact_created | enrichment_completed | draft_created | email_sent | etc
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("activities_contact_idx").on(table.contactId),
    index("activities_type_idx").on(table.type),
  ]
);

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  campaignContacts: many(campaignContacts),
  emails: many(emails),
  activities: many(activities),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  product: one(products, {
    fields: [campaigns.product],
    references: [products.id],
  }),
  campaignContacts: many(campaignContacts),
  emails: many(emails),
  activities: many(activities),
}));

export const campaignContactsRelations = relations(
  campaignContacts,
  ({ one }) => ({
    campaign: one(campaigns, {
      fields: [campaignContacts.campaignId],
      references: [campaigns.id],
    }),
    contact: one(contacts, {
      fields: [campaignContacts.contactId],
      references: [contacts.id],
    }),
  })
);

export const emailsRelations = relations(emails, ({ one }) => ({
  contact: one(contacts, {
    fields: [emails.contactId],
    references: [contacts.id],
  }),
  campaign: one(campaigns, {
    fields: [emails.campaignId],
    references: [campaigns.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  campaign: one(campaigns, {
    fields: [activities.campaignId],
    references: [campaigns.id],
  }),
}));

// Auth tables for Better Auth
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  image: text("image"),
  role: text("role").notNull().default("member"), // "admin" | "member"
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accounts = sqliteTable("accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verifications = sqliteTable("verifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Invites table for admin invite-only signups
export const invites = sqliteTable(
  "invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"), // pending | accepted | revoked
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("invites_token_idx").on(table.token),
    index("invites_email_idx").on(table.email),
  ]
);

// Auth relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  invites: many(invites),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  inviter: one(users, {
    fields: [invites.invitedBy],
    references: [users.id],
  }),
}));

// Type exports
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignContact = typeof campaignContacts.$inferSelect;
export type NewCampaignContact = typeof campaignContacts.$inferInsert;
export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type GmailToken = typeof gmailTokens.$inferSelect;
export type NewGmailToken = typeof gmailTokens.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;

// Stage type
export type CampaignContactStage =
  | "new"
  | "queued_enrich"
  | "enriching"
  | "enriched"
  | "queued_draft"
  | "drafting"
  | "drafted"
  | "approved"
  | "queued_send"
  | "sending"
  | "sent"
  | "replied"
  | "bounced"
  | "skipped";

// Activity type
export type ActivityType =
  | "contact_created"
  | "contact_updated"
  | "added_to_campaign"
  | "enrichment_started"
  | "enrichment_completed"
  | "draft_created"
  | "draft_regenerated"
  | "draft_approved"
  | "draft_rejected"
  | "email_sent"
  | "email_opened"
  | "email_replied"
  | "note_added"
  | "user_invited"
  | "invite_accepted"
  | "user_removed";
