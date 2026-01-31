import { createServerFn } from "@tanstack/react-start";
import { eq, and, inArray } from "drizzle-orm";
import { getDb, campaignContacts, companies, campaigns, activities } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getProduct, type ProductId } from "@/lib/products";

interface ExaResult {
  title: string;
  url: string;
  text?: string;
  highlights?: string[];
  summary?: string;
  publishedDate?: string;
  author?: string;
}

interface ExaResponse {
  results: ExaResult[];
  autopromptString?: string;
}

interface SearchExaOptions {
  query: string;
  apiKey: string;
  numResults?: number;
  category?: "company" | "news" | "tweet" | "github" | "people" | "pdf";
  useAutoprompt?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  livecrawl?: "always" | "fallback";
}

export async function searchExa(options: SearchExaOptions): Promise<ExaResult[]> {
  const {
    query,
    apiKey,
    numResults = 5,
    category,
    useAutoprompt = true,
    includeDomains,
    excludeDomains,
    startPublishedDate,
    livecrawl,
  } = options;

  const body: Record<string, unknown> = {
    query,
    type: "auto", // Exa 2.1 optimized search
    numResults,
    useAutoprompt,
    contents: {
      text: { maxCharacters: 2000 },
      highlights: { numSentences: 5 },
      summary: { query: "What does this company do and what are their recent achievements or challenges?" },
    },
  };

  if (category) body.category = category;
  if (includeDomains?.length) body.includeDomains = includeDomains;
  if (excludeDomains?.length) body.excludeDomains = excludeDomains;
  if (startPublishedDate) body.startPublishedDate = startPublishedDate;
  if (livecrawl) body.livecrawl = livecrawl;

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${error}`);
  }

  const data: ExaResponse = await response.json();
  return data.results || [];
}

// Multi-query enrichment for comprehensive company research
export async function enrichWithMultiQuery(
  companyName: string,
  productQuery: string,
  apiKey: string
): Promise<{
  companyResults: ExaResult[];
  newsResults: ExaResult[];
  allResults: ExaResult[];
}> {
  // Calculate date 6 months ago for recent content
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split("T")[0];

  // Run queries in parallel for speed
  const [companyResults, newsResults] = await Promise.all([
    // Query 1: Company-focused search with product context
    searchExa({
      query: productQuery,
      apiKey,
      numResults: 5,
      useAutoprompt: true,
      excludeDomains: ["facebook.com", "twitter.com", "instagram.com"],
    }),
    // Query 2: Recent news about the company
    searchExa({
      query: `${companyName} news announcement growth expansion`,
      apiKey,
      numResults: 3,
      category: "news",
      startPublishedDate: startDate,
      useAutoprompt: true,
    }),
  ]);

  // Combine and deduplicate by URL
  const seenUrls = new Set<string>();
  const allResults: ExaResult[] = [];

  for (const result of [...companyResults, ...newsResults]) {
    if (!seenUrls.has(result.url)) {
      seenUrls.add(result.url);
      allResults.push(result);
    }
  }

  return { companyResults, newsResults, allResults };
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

export function scoreEnrichmentQuality(
  results: ExaResult[],
  productId: ProductId
): { score: number; reasons: string[] } {
  const keywords = painPointKeywords[productId];
  if (!keywords) {
    return { score: 5, reasons: ["Unknown product"] };
  }

  let score = 0;
  const reasons: string[] = [];

  // Combine all text from results (including summaries)
  const fullText = results
    .map((r) => [r.title, r.summary, r.highlights?.join(" "), r.text].filter(Boolean).join(" "))
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

    const results = await searchExa({ query, apiKey: env.EXA_API_KEY });

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
          cc.contact.company?.name || cc.contact.email.split("@")[1]?.split(".")[0] || "company";
        const productQuery = product.enrichmentQuery(companyName);

        // Call Exa with multi-query approach
        const { companyResults, newsResults, allResults } = await enrichWithMultiQuery(
          companyName,
          productQuery,
          env.EXA_API_KEY
        );

        // Score enrichment quality
        const qualityScore = scoreEnrichmentQuality(
          allResults,
          campaign.product as ProductId
        );

        // Boost score if we found recent news
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
