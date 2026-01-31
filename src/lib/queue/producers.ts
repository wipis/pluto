import { createServerFn } from "@tanstack/react-start";
import { eq, and, inArray } from "drizzle-orm";
import { getDb, campaignContacts, campaigns } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { JobMessage } from "./types";

// Enqueue enrichment jobs for campaign contacts
export const enqueueEnrichment = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignId: string; contactIds?: string[] }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Get contacts to enrich (in "new" stage)
    const toEnrich = await db.query.campaignContacts.findMany({
      where: data.contactIds
        ? and(
            eq(campaignContacts.campaignId, data.campaignId),
            inArray(campaignContacts.contactId, data.contactIds)
          )
        : and(
            eq(campaignContacts.campaignId, data.campaignId),
            eq(campaignContacts.stage, "new")
          ),
    });

    if (toEnrich.length === 0) {
      return { queued: 0, message: "No contacts to enrich" };
    }

    // Mark all as queued
    await db
      .update(campaignContacts)
      .set({ stage: "queued_enrich", updatedAt: new Date() })
      .where(
        inArray(
          campaignContacts.id,
          toEnrich.map((c) => c.id)
        )
      );

    // Enqueue all jobs
    const messages = toEnrich.map((cc) => ({
      body: {
        type: "enrich" as const,
        campaignContactId: cc.id,
        campaignId: data.campaignId,
      },
    }));

    await (env as any).JOBS_QUEUE.sendBatch(messages);

    return { queued: toEnrich.length };
  });

// Enqueue drafting jobs for enriched contacts
export const enqueueDrafting = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignId: string; contactIds?: string[] }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Get enriched contacts ready for drafting
    const toDraft = await db.query.campaignContacts.findMany({
      where: data.contactIds
        ? and(
            eq(campaignContacts.campaignId, data.campaignId),
            inArray(campaignContacts.contactId, data.contactIds)
          )
        : and(
            eq(campaignContacts.campaignId, data.campaignId),
            eq(campaignContacts.stage, "enriched")
          ),
    });

    if (toDraft.length === 0) {
      return { queued: 0, message: "No contacts to draft" };
    }

    // Mark all as queued
    await db
      .update(campaignContacts)
      .set({ stage: "queued_draft", updatedAt: new Date() })
      .where(
        inArray(
          campaignContacts.id,
          toDraft.map((c) => c.id)
        )
      );

    // Enqueue all jobs
    const messages = toDraft.map((cc) => ({
      body: {
        type: "draft" as const,
        campaignContactId: cc.id,
        campaignId: data.campaignId,
      },
    }));

    await (env as any).JOBS_QUEUE.sendBatch(messages);

    return { queued: toDraft.length };
  });

// Enqueue sending jobs for approved contacts (with rate limiting via delay)
export const enqueueSending = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignId: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Get approved contacts ready for sending
    const toSend = await db.query.campaignContacts.findMany({
      where: and(
        eq(campaignContacts.campaignId, data.campaignId),
        eq(campaignContacts.stage, "approved")
      ),
    });

    if (toSend.length === 0) {
      return { queued: 0, message: "No contacts to send" };
    }

    // Mark all as queued
    await db
      .update(campaignContacts)
      .set({ stage: "queued_send", updatedAt: new Date() })
      .where(
        inArray(
          campaignContacts.id,
          toSend.map((c) => c.id)
        )
      );

    // Enqueue with delays for rate limiting (1 email per minute)
    const messages = toSend.map((cc, index) => ({
      body: {
        type: "send" as const,
        campaignContactId: cc.id,
      } satisfies JobMessage,
      delaySeconds: index * 60, // 1 per minute = 60 per hour
    }));

    await (env as any).JOBS_QUEUE.sendBatch(messages);

    return {
      queued: toSend.length,
      estimatedMinutes: toSend.length,
    };
  });

// Get campaign progress stats for polling
export const getCampaignProgress = createServerFn({ method: "GET" })
  .inputValidator((data: { campaignId: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const contacts = await db.query.campaignContacts.findMany({
      where: eq(campaignContacts.campaignId, data.campaignId),
      columns: { stage: true },
    });

    const stageCounts = contacts.reduce(
      (acc, c) => {
        acc[c.stage] = (acc[c.stage] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: contacts.length,
      stages: stageCounts,
      // Convenience counts
      queued:
        (stageCounts.queued_enrich || 0) +
        (stageCounts.queued_draft || 0) +
        (stageCounts.queued_send || 0),
      processing:
        (stageCounts.enriching || 0) +
        (stageCounts.drafting || 0) +
        (stageCounts.sending || 0),
      new: stageCounts.new || 0,
      enriched: stageCounts.enriched || 0,
      drafted: stageCounts.drafted || 0,
      approved: stageCounts.approved || 0,
      sent: stageCounts.sent || 0,
      replied: stageCounts.replied || 0,
    };
  });
