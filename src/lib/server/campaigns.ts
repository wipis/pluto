import { createServerFn } from "@tanstack/react-start";
import { eq, desc, count, sql, and, inArray } from "drizzle-orm";
import {
  getDb,
  campaigns,
  campaignContacts,
  activities,
  products,
} from "@/lib/db";
import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import {
  getCampaignsInput,
  getCampaignInput,
  createCampaignInput,
  updateCampaignInput,
  addContactsToCampaignInput,
  removeContactFromCampaignInput,
  getCampaignContactsByStageInput,
} from "@/lib/validation";

// Get all campaigns with counts
export const getCampaigns = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCampaignsInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    let baseQuery = db
      .select({
        campaign: campaigns,
        total: count(campaignContacts.id),
        newCount: sql<number>`count(case when ${campaignContacts.stage} = 'new' then 1 end)`,
        enrichedCount: sql<number>`count(case when ${campaignContacts.stage} = 'enriched' then 1 end)`,
        draftedCount: sql<number>`count(case when ${campaignContacts.stage} = 'drafted' then 1 end)`,
        approvedCount: sql<number>`count(case when ${campaignContacts.stage} = 'approved' then 1 end)`,
        sentCount: sql<number>`count(case when ${campaignContacts.stage} = 'sent' then 1 end)`,
        repliedCount: sql<number>`count(case when ${campaignContacts.stage} = 'replied' then 1 end)`,
      })
      .from(campaigns)
      .leftJoin(campaignContacts, eq(campaigns.id, campaignContacts.campaignId))
      .groupBy(campaigns.id)
      .orderBy(desc(campaigns.createdAt));

    if (data?.status) {
      baseQuery = baseQuery.where(eq(campaigns.status, data.status));
    }

    if (data?.product) {
      baseQuery = baseQuery.where(eq(campaigns.product, data.product));
    }

    const results = await baseQuery;

    return results.map((r) => ({
      ...r.campaign,
      counts: {
        total: r.total,
        new: r.newCount,
        enriched: r.enrichedCount,
        drafted: r.draftedCount,
        approved: r.approvedCount,
        sent: r.sentCount,
        replied: r.repliedCount,
      },
    }));
  });

// Get single campaign with contacts
export const getCampaign = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCampaignInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, data.id),
      with: {
        campaignContacts: {
          with: {
            contact: {
              with: { company: true },
            },
          },
          orderBy: desc(campaignContacts.createdAt),
        },
      },
    });

    return campaign;
  });

// Create campaign
export const createCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createCampaignInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Validate product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, data.product),
    });

    if (!product) {
      throw new NotFoundError("Product", data.product);
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        name: data.name,
        product: data.product,
        description: data.description,
        templatePrompt: data.templatePrompt,
        gmailAccountId: data.gmailAccountId,
        status: "draft",
      })
      .returning();

    return campaign;
  });

// Update campaign
export const updateCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateCampaignInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const { id, ...updates } = data;

    const [campaign] = await db
      .update(campaigns)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning();

    return campaign;
  });

// Add contacts to campaign
export const addContactsToCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => addContactsToCampaignInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Check for existing campaign contacts to avoid duplicates
    const existing = await db
      .select({ contactId: campaignContacts.contactId })
      .from(campaignContacts)
      .where(
        and(
          eq(campaignContacts.campaignId, data.campaignId),
          inArray(campaignContacts.contactId, data.contactIds)
        )
      );

    const existingIds = new Set(existing.map((e) => e.contactId));
    const newContactIds = data.contactIds.filter((id) => !existingIds.has(id));

    if (newContactIds.length === 0) {
      return { added: 0, skipped: data.contactIds.length };
    }

    const values = newContactIds.map((contactId) => ({
      campaignId: data.campaignId,
      contactId,
      stage: "new" as const,
    }));

    await db.insert(campaignContacts).values(values);

    // Log activities
    await db.insert(activities).values(
      newContactIds.map((contactId) => ({
        contactId,
        campaignId: data.campaignId,
        type: "added_to_campaign" as const,
      }))
    );

    return { added: newContactIds.length, skipped: existingIds.size };
  });

// Remove contact from campaign
export const removeContactFromCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => removeContactFromCampaignInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    await db
      .delete(campaignContacts)
      .where(
        and(
          eq(campaignContacts.campaignId, data.campaignId),
          eq(campaignContacts.contactId, data.contactId)
        )
      );

    return { success: true };
  });

// Get campaign contacts by stage
export const getCampaignContactsByStage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCampaignContactsByStageInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    let query = db.query.campaignContacts.findMany({
      where: data.stage
        ? and(
            eq(campaignContacts.campaignId, data.campaignId),
            eq(campaignContacts.stage, data.stage)
          )
        : eq(campaignContacts.campaignId, data.campaignId),
      with: {
        contact: {
          with: { company: true },
        },
      },
      orderBy: desc(campaignContacts.createdAt),
    });

    return query;
  });
