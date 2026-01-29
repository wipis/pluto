import { createServerFn } from "@tanstack/react-start";
import { eq, desc, and } from "drizzle-orm";
import { getDb, campaignContacts, activities } from "@/lib/db";

// Get drafts for review queue
export const getReviewQueue = createServerFn({ method: "GET" })
  .inputValidator((data?: { campaignId?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const drafts = await db.query.campaignContacts.findMany({
      where: data?.campaignId
        ? and(
            eq(campaignContacts.stage, "drafted"),
            eq(campaignContacts.campaignId, data.campaignId)
          )
        : eq(campaignContacts.stage, "drafted"),
      with: {
        contact: {
          with: { company: true },
        },
        campaign: true,
      },
      orderBy: desc(campaignContacts.updatedAt),
    });

    return drafts;
  });

// Approve a draft
export const approveDraft = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      campaignContactId: string;
      finalSubject: string;
      finalBody: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const [updated] = await db
      .update(campaignContacts)
      .set({
        stage: "approved",
        finalSubject: data.finalSubject,
        finalBody: data.finalBody,
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, data.campaignContactId))
      .returning();

    // Get the campaign contact to log activity
    const cc = await db.query.campaignContacts.findFirst({
      where: eq(campaignContacts.id, data.campaignContactId),
    });

    if (cc) {
      await db.insert(activities).values({
        contactId: cc.contactId,
        campaignId: cc.campaignId,
        type: "draft_approved",
      });
    }

    return updated;
  });

// Reject a draft (skip contact)
export const rejectDraft = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignContactId: string }) => data)
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const [updated] = await db
      .update(campaignContacts)
      .set({
        stage: "skipped",
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, data.campaignContactId))
      .returning();

    const cc = await db.query.campaignContacts.findFirst({
      where: eq(campaignContacts.id, data.campaignContactId),
    });

    if (cc) {
      await db.insert(activities).values({
        contactId: cc.contactId,
        campaignId: cc.campaignId,
        type: "draft_rejected",
      });
    }

    return updated;
  });

// Update draft content without approving
export const updateDraft = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      campaignContactId: string;
      draftSubject?: string;
      draftBody?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const { campaignContactId, ...updates } = data;

    const [updated] = await db
      .update(campaignContacts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, campaignContactId))
      .returning();

    return updated;
  });
