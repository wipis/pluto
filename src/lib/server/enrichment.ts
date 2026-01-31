import { createServerFn } from "@tanstack/react-start";
import { eq, and, inArray } from "drizzle-orm";
import { getDb, campaignContacts, companies, campaigns, activities } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getProduct, type ProductId } from "@/lib/products";

interface ExaResult {
  title: string;
  url: string;
  text: string;
  highlights?: string[];
}

interface ExaResponse {
  results: ExaResult[];
}

async function searchExa(query: string, apiKey: string): Promise<ExaResult[]> {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "neural",
      numResults: 5,
      contents: {
        text: { maxCharacters: 1500 },
        highlights: { numSentences: 3 },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${error}`);
  }

  const data: ExaResponse = await response.json();
  return data.results || [];
}

// Pain-point keywords for quality scoring
const painPointKeywords: Record<ProductId, {
  highValue: string[];
  signals: { growth: string[]; pain: string[] };
}> = {
  "file-logic": {
    highValue: ["medical records", "case volume", "timeline", "compliance", "HIPAA", "backlog", "disability"],
    signals: {
      growth: ["hiring", "expanding", "new office", "growth", "new attorneys"],
      pain: ["delays", "bottleneck", "behind", "struggling", "backlog", "overwhelmed"],
    },
  },
  consulting: {
    highValue: ["launching", "redesign", "rebuild", "migration", "deadline", "React", "Next.js", "frontend"],
    signals: {
      growth: ["Series A", "Series B", "funding", "hiring", "raised"],
      pain: ["technical debt", "shipping slow", "design gap", "capacity"],
    },
  },
  offerarc: {
    highValue: ["ad fatigue", "creative testing", "ROAS", "scaling", "CPM", "Facebook ads", "Meta ads"],
    signals: {
      growth: ["new clients", "expanding", "team growing", "scaling"],
      pain: ["creative burnout", "testing velocity", "diminishing returns", "fatigue"],
    },
  },
};

function scoreEnrichmentQuality(
  results: ExaResult[],
  productId: ProductId
): { score: number; reasons: string[] } {
  const keywords = painPointKeywords[productId];
  if (!keywords) {
    return { score: 5, reasons: ["Unknown product"] };
  }

  let score = 0;
  const reasons: string[] = [];

  // Combine all text from results
  const fullText = results
    .map((r) => [r.title, r.highlights?.join(" "), r.text].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase();

  // Check for high-value keywords (3 points each)
  for (const keyword of keywords.highValue) {
    if (fullText.includes(keyword.toLowerCase())) {
      score += 3;
      reasons.push(`High-value: "${keyword}"`);
    }
  }

  // Check for growth signals (2 points each)
  for (const term of keywords.signals.growth) {
    if (fullText.includes(term.toLowerCase())) {
      score += 2;
      reasons.push(`Growth signal: "${term}"`);
    }
  }

  // Check for pain signals (2 points each)
  for (const term of keywords.signals.pain) {
    if (fullText.includes(term.toLowerCase())) {
      score += 2;
      reasons.push(`Pain signal: "${term}"`);
    }
  }

  // Bonus for having multiple results with content
  const resultsWithContent = results.filter((r) => r.text && r.text.length > 100);
  if (resultsWithContent.length >= 3) {
    score += 2;
    reasons.push("Rich content available");
  }

  // Cap at 10
  return {
    score: Math.min(score, 10),
    reasons: reasons.slice(0, 5), // Top 5 reasons
  };
}

// Enrich a single company
export const enrichCompany = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; productId?: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    if (!env.EXA_API_KEY) {
      throw new Error("EXA_API_KEY not configured");
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, data.companyId),
    });

    if (!company) {
      throw new Error("Company not found");
    }

    // Build query based on product or generic
    let query: string;
    if (data.productId) {
      const product = getProduct(data.productId as any);
      query = product.enrichmentQuery(company.name);
    } else {
      query = `${company.name} ${company.domain || ""} company overview`;
    }

    const results = await searchExa(query, env.EXA_API_KEY);

    const enrichmentData = {
      query,
      results,
      enrichedAt: new Date().toISOString(),
    };

    const [updated] = await db
      .update(companies)
      .set({
        enrichmentData: JSON.stringify(enrichmentData),
        enrichedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companies.id, data.companyId))
      .returning();

    return updated;
  });

// Enrich campaign contacts
export const enrichCampaignContacts = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignId: string; contactIds?: string[] }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    if (!env.EXA_API_KEY) {
      throw new Error("EXA_API_KEY not configured");
    }

    // Get campaign to know which product
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, data.campaignId),
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const product = getProduct(campaign.product as any);

    // Get contacts to enrich
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
      with: {
        contact: { with: { company: true } },
      },
    });

    const results = { enriched: 0, failed: 0, errors: [] as string[] };

    for (const cc of toEnrich) {
      try {
        // Update stage to enriching
        await db
          .update(campaignContacts)
          .set({ stage: "enriching", updatedAt: new Date() })
          .where(eq(campaignContacts.id, cc.id));

        // Build search query
        const companyName =
          cc.contact.company?.name || cc.contact.email.split("@")[1] || "company";
        const query = product.enrichmentQuery(companyName);

        // Call Exa
        const exaResults = await searchExa(query, env.EXA_API_KEY);

        // Score enrichment quality
        const qualityScore = scoreEnrichmentQuality(
          exaResults,
          campaign.product as ProductId
        );

        const enrichmentData = {
          query,
          companyName,
          results: exaResults,
          qualityScore: qualityScore.score,
          qualityReasons: qualityScore.reasons,
          enrichedAt: new Date().toISOString(),
        };

        // Update campaign contact with enrichment and score
        await db
          .update(campaignContacts)
          .set({
            stage: "enriched",
            enrichmentData: JSON.stringify(enrichmentData),
            enrichmentScore: qualityScore.score,
            updatedAt: new Date(),
          })
          .where(eq(campaignContacts.id, cc.id));

        // Also update company enrichment data if not already enriched
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
          campaignId: data.campaignId,
          type: "enrichment_completed",
        });

        results.enriched++;
      } catch (e) {
        // Mark as failed but don't stop
        await db
          .update(campaignContacts)
          .set({ stage: "new", updatedAt: new Date() })
          .where(eq(campaignContacts.id, cc.id));

        results.failed++;
        results.errors.push(
          `${cc.contact.email}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return results;
  });
