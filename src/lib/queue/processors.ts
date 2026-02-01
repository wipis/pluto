import { eq } from "drizzle-orm";
import { getDb, campaignContacts, activities, companies, products } from "@/lib/db";
import { buildEnrichmentQuery } from "@/lib/server/products";
import type { JobMessage, JobResult } from "./types";

// Process a single enrichment job
export async function processEnrichment(
  job: Extract<JobMessage, { type: "enrich" }>,
  env: Cloudflare.Env
): Promise<JobResult> {
  const db = getDb(env.DB);

  // Get the campaign contact
  const cc = await db.query.campaignContacts.findFirst({
    where: eq(campaignContacts.id, job.campaignContactId),
    with: {
      contact: { with: { company: true } },
      campaign: true,
    },
  });

  if (!cc) {
    return { success: true }; // Already deleted, skip
  }

  // Only process if in queued_enrich stage
  if (cc.stage !== "queued_enrich") {
    return { success: true }; // Already processed or skipped
  }

  try {
    // Update to enriching
    await db
      .update(campaignContacts)
      .set({ stage: "enriching", updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    // Get product from DB
    const product = await db.query.products.findFirst({
      where: eq(products.id, cc.campaign.product),
    });

    if (!product) {
      throw new Error("Product not found for campaign");
    }

    // Build search query
    const companyName =
      cc.contact.company?.name ||
      cc.contact.email.split("@")[1]?.split(".")[0] ||
      "company";
    const productQuery = buildEnrichmentQuery(product.enrichmentQueryTemplate, companyName);

    // Import and use enrichment logic
    const { enrichWithMultiQuery, scoreEnrichmentQuality } = await import(
      "@/lib/server/enrichment"
    );

    const { companyResults, newsResults, allResults } = await enrichWithMultiQuery(
      companyName,
      productQuery,
      env.EXA_API_KEY
    );

    // Score enrichment quality
    const qualityScore = scoreEnrichmentQuality(
      allResults,
      cc.campaign.product
    );

    const hasRecentNews = newsResults.length > 0;
    if (hasRecentNews) {
      qualityScore.score = Math.min(qualityScore.score + 2, 10);
      qualityScore.reasons.unshift("Recent news found");
    }

    const enrichmentData = {
      query: productQuery,
      companyName,
      results: allResults,
      companyResultCount: companyResults.length,
      newsResultCount: newsResults.length,
      hasRecentNews,
      qualityScore: qualityScore.score,
      qualityReasons: qualityScore.reasons,
      enrichedAt: new Date().toISOString(),
    };

    // Update with enrichment data
    await db
      .update(campaignContacts)
      .set({
        stage: "enriched",
        enrichmentData: JSON.stringify(enrichmentData),
        enrichmentScore: qualityScore.score,
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, cc.id));

    // Update company if not already enriched
    if (cc.contact.companyId && !cc.contact.company?.enrichedAt) {
      await db
        .update(companies)
        .set({
          enrichmentData: JSON.stringify(enrichmentData),
          enrichedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, cc.contact.companyId));
    }

    // Log activity
    await db.insert(activities).values({
      contactId: cc.contactId,
      campaignId: job.campaignId,
      type: "enrichment_completed",
    });

    return { success: true };
  } catch (error) {
    // Revert to new stage on failure
    await db
      .update(campaignContacts)
      .set({ stage: "new", updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      retryable: true,
    };
  }
}

// Process a single drafting job
export async function processDrafting(
  job: Extract<JobMessage, { type: "draft" }>,
  env: Cloudflare.Env
): Promise<JobResult> {
  const db = getDb(env.DB);

  const cc = await db.query.campaignContacts.findFirst({
    where: eq(campaignContacts.id, job.campaignContactId),
    with: {
      contact: { with: { company: true } },
      campaign: true,
    },
  });

  if (!cc) {
    return { success: true };
  }

  if (cc.stage !== "queued_draft") {
    return { success: true };
  }

  try {
    // Update to drafting
    await db
      .update(campaignContacts)
      .set({ stage: "drafting", updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    // Get product from DB
    const product = await db.query.products.findFirst({
      where: eq(products.id, cc.campaign.product),
    });

    if (!product) {
      throw new Error("Product not found for campaign");
    }

    // Parse enrichment data
    const enrichment = cc.enrichmentData ? JSON.parse(cc.enrichmentData) : null;
    const enrichmentSummary =
      enrichment?.results
        ?.map((r: any) =>
          r.summary || r.highlights?.join(" ") || r.text?.substring(0, 500)
        )
        .filter(Boolean)
        .join("\n\n") || "No research data available.";

    const contactName =
      [cc.contact.firstName, cc.contact.lastName].filter(Boolean).join(" ") ||
      "there";
    const companyName = cc.contact.company?.name || "their company";

    const contactInfo = {
      name: contactName,
      title: cc.contact.title || "Unknown",
      companyName,
      email: cc.contact.email,
    };

    // Import drafting functions
    const { extractHook, buildStructuredPrompt, callClaude, parseEmailResponse } =
      await import("@/lib/server/drafting");

    // Extract hook
    const extractedHook = await extractHook(
      enrichmentSummary,
      product,
      contactInfo,
      env.ANTHROPIC_API_KEY
    );

    // Build prompt
    const userPrompt = buildStructuredPrompt(
      product,
      contactInfo,
      enrichmentSummary,
      extractedHook,
      cc.campaign.templatePrompt
    );

    // Generate draft
    const response = await callClaude(
      product.emailSystemPrompt,
      [{ role: "user", content: userPrompt }],
      env.ANTHROPIC_API_KEY
    );

    const { subject, body } = parseEmailResponse(response);

    // Update with draft
    await db
      .update(campaignContacts)
      .set({
        stage: "drafted",
        draftSubject: subject,
        draftBody: body,
        hookUsed: extractedHook.hook,
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, cc.id));

    // Log activity
    await db.insert(activities).values({
      contactId: cc.contactId,
      campaignId: job.campaignId,
      type: "draft_created",
      metadata: JSON.stringify({
        hook: extractedHook.hook,
        angle: extractedHook.angle,
      }),
    });

    return { success: true };
  } catch (error) {
    // Revert to enriched stage on failure
    await db
      .update(campaignContacts)
      .set({ stage: "enriched", updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      retryable: true,
    };
  }
}

// Process a single send job
export async function processSending(
  job: Extract<JobMessage, { type: "send" }>,
  env: Cloudflare.Env
): Promise<JobResult> {
  const db = getDb(env.DB);

  const cc = await db.query.campaignContacts.findFirst({
    where: eq(campaignContacts.id, job.campaignContactId),
    with: {
      contact: true,
      campaign: true,
    },
  });

  if (!cc) {
    return { success: true };
  }

  if (cc.stage !== "queued_send") {
    return { success: true };
  }

  try {
    // Update to sending
    await db
      .update(campaignContacts)
      .set({ stage: "sending", updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    // Import and use send function
    const { sendEmail } = await import("@/lib/server/gmail");
    const result = await sendEmail({ campaignContactId: cc.id });

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    return { success: true };
  } catch (error) {
    // Revert to approved stage on failure
    await db
      .update(campaignContacts)
      .set({ stage: "approved", updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Don't retry auth errors
    const isAuthError =
      errorMessage.includes("401") || errorMessage.includes("403");

    return {
      success: false,
      error: errorMessage,
      retryable: !isAuthError,
    };
  }
}

// Process reply checking job
export async function processReplyCheck(env: Cloudflare.Env): Promise<JobResult> {
  try {
    const { checkReplies } = await import("@/lib/server/gmail");
    await checkReplies();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      retryable: true,
    };
  }
}
