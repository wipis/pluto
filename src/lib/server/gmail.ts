import { createServerFn } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { getDb, campaignContacts } from "@/lib/db";

interface ComposioEnv {
  DB: D1Database;
  COMPOSIO_API_KEY?: string;
}

// Stub: Get Gmail connection status
export const getGmailConnection = createServerFn({ method: "GET" })
  .validator((data?: {}) => data ?? {})
  .handler(async () => {
    // TODO: Implement with Composio
    return {
      connected: false,
      connectionId: null,
      email: null,
    };
  });

// Stub: Initiate Gmail OAuth connection
export const initiateGmailConnection = createServerFn({ method: "POST" })
  .validator((data: { redirectUrl: string }) => data)
  .handler(async ({ data }) => {
    // TODO: Implement with Composio
    return {
      authUrl: null,
      connectionId: null,
    };
  });

// Send a single email (stub for now)
export const sendEmail = createServerFn({ method: "POST" })
  .validator((data: { campaignContactId: string }) => data)
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as ComposioEnv;
    const db = getDb(env.DB);

    const cc = await db.query.campaignContacts.findFirst({
      where: eq(campaignContacts.id, data.campaignContactId),
      with: { contact: true, campaign: true },
    });

    if (!cc) {
      throw new Error("Campaign contact not found");
    }

    if (cc.stage !== "approved") {
      throw new Error("Email must be approved before sending");
    }

    // TODO: Implement actual sending with Composio
    throw new Error("Gmail not connected. Please configure COMPOSIO_API_KEY and connect Gmail in Settings.");
  });

// Send batch of approved emails
export const sendBatch = createServerFn({ method: "POST" })
  .validator((data: { campaignId: string; contactIds?: string[] }) => data)
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as ComposioEnv;
    const db = getDb(env.DB);

    const toSend = await db.query.campaignContacts.findMany({
      where: and(
        eq(campaignContacts.campaignId, data.campaignId),
        eq(campaignContacts.stage, "approved")
      ),
    });

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const cc of toSend) {
      try {
        await sendEmail({ data: { campaignContactId: cc.id } });
        results.sent++;
      } catch (e) {
        results.failed++;
        results.errors.push(
          `${cc.id}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return results;
  });

// Check for replies (stub for now)
export const checkReplies = createServerFn({ method: "POST" })
  .validator((data?: {}) => data ?? {})
  .handler(async () => {
    // TODO: Implement with Composio
    return { found: 0 };
  });
