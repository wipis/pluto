import { createServerFn } from "@tanstack/react-start";
import { eq, and, isNotNull } from "drizzle-orm";
import { getDb, campaignContacts, emails, gmailTokens } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { generateAuthUrl, getValidAccessToken } from "./gmail-auth";
import { sendGmailEmail, getThread, getGmailProfile } from "./gmail-api";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  initiateGmailConnectionInput,
  sendEmailInput,
  sendBatchInput,
} from "@/lib/validation";

// Get Gmail connection status
export const getGmailConnection = createServerFn({ method: "GET" })
  .inputValidator((data?: {}) => data ?? {})
  .handler(async () => {
    const env = getEnv();
    const db = getDb(env.DB);

    const tokens = await db.query.gmailTokens.findFirst();

    if (!tokens) {
      return { connected: false, connectionId: null, email: null };
    }

    // Check if token is expired (without buffer)
    const isExpired = new Date(tokens.expiresAt) < new Date();

    return {
      connected: !isExpired || !!tokens.refreshToken,
      connectionId: tokens.id,
      email: tokens.userEmail,
    };
  });

// Initiate Gmail OAuth connection
export const initiateGmailConnection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => initiateGmailConnectionInput.parse(data))
  .handler(async ({ data }) => {
    // The redirectUrl from the client is used to build the callback URI
    const url = new URL(data.redirectUrl);
    const origin = url.origin;
    const callbackUri = `${origin}/api/auth/gmail/callback`;

    const authUrl = generateAuthUrl(callbackUri, origin);

    return { authUrl, connectionId: null };
  });

// Send a single email
export const sendEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendEmailInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Get campaign contact with email content (including campaign for gmailAccountId)
    const cc = await db.query.campaignContacts.findFirst({
      where: eq(campaignContacts.id, data.campaignContactId),
      with: { contact: true, campaign: true },
    });

    if (!cc) {
      throw new NotFoundError("Campaign contact", data.campaignContactId);
    }

    if (cc.stage !== "approved") {
      throw new ValidationError("Email must be approved before sending");
    }

    // Get valid access token for the campaign's Gmail account (or default)
    const accessToken = await getValidAccessToken(cc.campaign.gmailAccountId || undefined);

    // Get sender's email
    const profile = await getGmailProfile(accessToken);
    const fromEmail = profile.emailAddress;

    const subject = cc.finalSubject || cc.draftSubject;
    const body = cc.finalBody || cc.draftBody;

    if (!subject || !body) {
      throw new ValidationError("Email subject and body are required");
    }

    // Send via Gmail API
    const result = await sendGmailEmail({
      to: cc.contact.email,
      from: fromEmail,
      subject,
      body,
      accessToken,
    });

    // Update campaign contact
    await db
      .update(campaignContacts)
      .set({
        stage: "sent",
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, data.campaignContactId));

    // Store in emails table
    await db.insert(emails).values({
      contactId: cc.contactId,
      campaignId: cc.campaignId,
      threadId: result.threadId,
      messageId: result.id,
      direction: "outbound",
      subject,
      body,
      status: "sent",
      sentAt: new Date(),
    });

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    };
  });

// Send batch of approved emails
export const sendBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendBatchInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
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

// Check for replies to sent emails
export const checkReplies = createServerFn({ method: "POST" })
  .inputValidator((data?: {}) => data ?? {})
  .handler(async () => {
    const env = getEnv();
    const db = getDb(env.DB);

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
    } catch {
      // Gmail not connected
      return { found: 0, error: "Gmail not connected" };
    }

    // Get all sent emails with threadIds that haven't been marked as replied
    const sentEmails = await db.query.emails.findMany({
      where: and(
        eq(emails.direction, "outbound"),
        eq(emails.status, "sent"),
        isNotNull(emails.threadId)
      ),
    });

    let found = 0;

    for (const email of sentEmails) {
      if (!email.threadId) continue;

      try {
        // Get thread from Gmail
        const thread = await getThread(email.threadId, accessToken);

        // Count messages in thread
        const threadMessageCount = thread.messages?.length || 0;

        // Get existing messages in this thread from our DB
        const existingMessages = await db.query.emails.findMany({
          where: eq(emails.threadId, email.threadId),
        });

        // If there are more messages in the thread than we have, there's a reply
        if (threadMessageCount > existingMessages.length) {
          found++;

          // Update the original email status
          await db
            .update(emails)
            .set({ status: "replied" })
            .where(eq(emails.id, email.id));

          // Update campaign contact if exists
          if (email.campaignId) {
            const cc = await db.query.campaignContacts.findFirst({
              where: and(
                eq(campaignContacts.contactId, email.contactId),
                eq(campaignContacts.campaignId, email.campaignId)
              ),
            });

            if (cc) {
              await db
                .update(campaignContacts)
                .set({
                  stage: "replied",
                  repliedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(campaignContacts.id, cc.id));
            }
          }
        }
      } catch (e) {
        console.error(`Error checking thread ${email.threadId}:`, e);
      }
    }

    return { found };
  });

// Disconnect Gmail (remove tokens)
export const disconnectGmail = createServerFn({ method: "POST" })
  .inputValidator((data?: {}) => data ?? {})
  .handler(async () => {
    const env = getEnv();
    const db = getDb(env.DB);

    const tokens = await db.query.gmailTokens.findFirst();

    if (tokens) {
      await db.delete(gmailTokens).where(eq(gmailTokens.id, tokens.id));
    }

    return { success: true };
  });
