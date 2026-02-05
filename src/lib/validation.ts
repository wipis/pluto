import { z } from "zod";

// --- Reusable base schemas ---

export const idSchema = z.string().min(1).max(30);

export const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

// --- Campaigns ---

export const getCampaignsInput = z
  .object({
    status: z.string().max(50).optional(),
    product: z.string().max(30).optional(),
  })
  .optional()
  .default({});

export const getCampaignInput = z.object({
  id: idSchema,
});

export const createCampaignInput = z.object({
  name: z.string().min(1).max(500),
  product: idSchema,
  description: z.string().max(5000).optional(),
  templatePrompt: z.string().max(5000).optional(),
  gmailAccountId: z.string().max(30).optional(),
});

export const updateCampaignInput = z.object({
  id: idSchema,
  name: z.string().min(1).max(500).optional(),
  product: idSchema.optional(),
  description: z.string().max(5000).optional(),
  templatePrompt: z.string().max(5000).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  gmailAccountId: z.string().max(30).optional(),
});

export const addContactsToCampaignInput = z.object({
  campaignId: idSchema,
  contactIds: z.array(idSchema).min(1).max(1000),
});

export const removeContactFromCampaignInput = z.object({
  campaignId: idSchema,
  contactId: idSchema,
});

export const getCampaignContactsByStageInput = z.object({
  campaignId: idSchema,
  stage: z.string().max(50).optional(),
});

// --- Contacts ---

export const getContactsInput = z.object({
  search: z.string().max(500).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const getContactInput = z.object({
  id: idSchema,
});

export const createContactInput = z.object({
  firstName: z.string().max(500),
  lastName: z.string().max(500),
  email: emailSchema,
  companyId: z.string().max(30).optional(),
  companyName: z.string().max(500).optional(),
  domain: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  linkedinUrl: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

export const updateContactInput = z.object({
  id: idSchema,
  firstName: z.string().max(500).optional(),
  lastName: z.string().max(500).optional(),
  email: emailSchema.optional(),
  companyId: z.string().max(30).optional(),
  title: z.string().max(500).optional(),
  linkedinUrl: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

export const deleteContactInput = z.object({
  id: idSchema,
});

// --- Companies ---

export const getCompaniesInput = z
  .object({
    search: z.string().max(500).optional(),
    enriched: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .optional()
  .default({});

export const getCompanyInput = z.object({
  id: idSchema,
});

export const createCompanyInput = z.object({
  name: z.string().min(1).max(500),
  domain: z.string().max(500).optional(),
});

export const updateCompanyInput = z.object({
  id: idSchema,
  name: z.string().max(500).optional(),
  domain: z.string().max(500).optional(),
});

export const findOrCreateCompanyInput = z.object({
  name: z.string().min(1).max(500),
  domain: z.string().max(500).optional(),
});

// --- Products ---

export const getProductInput = z.object({
  id: idSchema,
});

export const createProductInput = z.object({
  name: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  valueProps: z.array(z.string().max(500)).min(1).max(20),
  targetAudience: z.string().min(1).max(5000),
  enrichmentQueryTemplate: z.string().min(1).max(5000),
  emailSystemPrompt: z.string().min(1).max(5000),
});

export const updateProductInput = z.object({
  id: idSchema,
  name: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  valueProps: z.array(z.string().max(500)).max(20).optional(),
  targetAudience: z.string().max(5000).optional(),
  enrichmentQueryTemplate: z.string().max(5000).optional(),
  emailSystemPrompt: z.string().max(5000).optional(),
});

export const deleteProductInput = z.object({
  id: idSchema,
});

// --- Enrichment ---

export const enrichCompanyInput = z.object({
  companyId: idSchema,
  productId: idSchema.optional(),
});

export const enrichCampaignContactsInput = z.object({
  campaignId: idSchema,
  contactIds: z.array(idSchema).max(1000).optional(),
});

// --- Drafting ---

export const draftCampaignEmailsInput = z.object({
  campaignId: idSchema,
  contactIds: z.array(idSchema).max(1000).optional(),
});

export const regenerateDraftInput = z.object({
  campaignContactId: idSchema,
  feedback: z.string().max(5000).optional(),
});

// --- Review ---

export const getReviewQueueInput = z
  .object({
    campaignId: idSchema.optional(),
  })
  .optional()
  .default({});

export const approveDraftInput = z.object({
  campaignContactId: idSchema,
  finalSubject: z.string().min(1).max(200),
  finalBody: z.string().min(1).max(10000),
});

export const rejectDraftInput = z.object({
  campaignContactId: idSchema,
});

export const updateDraftInput = z.object({
  campaignContactId: idSchema,
  draftSubject: z.string().max(200).optional(),
  draftBody: z.string().max(10000).optional(),
});

// --- Gmail ---

export const initiateGmailConnectionInput = z.object({
  redirectUrl: z.string().min(1).max(500),
});

export const sendEmailInput = z.object({
  campaignContactId: idSchema,
});

export const sendBatchInput = z.object({
  campaignId: idSchema,
  contactIds: z.array(idSchema).max(1000).optional(),
});

export const deleteGmailAccountInput = z.object({
  accountId: idSchema,
});

export const updateAccountLabelInput = z.object({
  accountId: idSchema,
  label: z.string().min(1).max(500),
});

// --- Import ---

const csvRowSchema = z.object({
  firstName: z.string().max(500).optional(),
  lastName: z.string().max(500).optional(),
  email: z.string().min(1).max(255),
  company: z.string().max(500).optional(),
  domain: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  linkedinUrl: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
});

export const importContactsInput = z.object({
  rows: z.array(csvRowSchema).min(1).max(10000),
  campaignId: z.string().max(30).optional(),
});

export const parseCSVInput = z.object({
  csvText: z.string().min(1).max(5_000_000),
  columnMapping: z.record(z.string().max(100), z.string().max(100)),
});

// --- Invites ---

export const validateInviteTokenInput = z.object({
  token: z.string().min(1).max(100),
});

export const createInviteInput = z.object({
  email: emailSchema,
});

export const revokeInviteInput = z.object({
  id: idSchema,
});

export const removeUserInput = z.object({
  id: idSchema,
});

// --- Stats ---

export const getContactActivitiesInput = z.object({
  contactId: idSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// --- Producers ---

export const enqueueEnrichmentInput = z.object({
  campaignId: idSchema,
  contactIds: z.array(idSchema).max(1000).optional(),
});

export const enqueueDraftingInput = z.object({
  campaignId: idSchema,
  contactIds: z.array(idSchema).max(1000).optional(),
});

export const enqueueSendingInput = z.object({
  campaignId: idSchema,
});

export const getCampaignProgressInput = z.object({
  campaignId: idSchema,
});
