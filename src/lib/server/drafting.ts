import { createServerFn } from "@tanstack/react-start";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getDb, campaignContacts, campaigns, activities } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getProduct, type Product } from "@/lib/products";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: "text"; text: string }>;
}

async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  apiKey: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data: ClaudeResponse = await response.json();
  return data.content[0]?.text || "";
}

function parseEmailResponse(response: string): { subject: string; body: string } {
  // Try to parse SUBJECT: and BODY: format
  const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n|BODY:)/is);
  const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i);

  if (subjectMatch && bodyMatch) {
    return {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim(),
    };
  }

  // Fallback: first line is subject, rest is body
  const lines = response.trim().split("\n");
  const subject = lines[0].replace(/^(Subject|SUBJECT):\s*/i, "").trim();
  const body = lines.slice(1).join("\n").trim();

  return { subject: subject || "Following up", body: body || response };
}

interface ExtractedHook {
  hook: string;
  angle: string;
  proofPoint: string;
}

async function extractHook(
  enrichmentSummary: string,
  product: Product,
  contact: { name: string; title: string; companyName: string },
  apiKey: string
): Promise<ExtractedHook> {
  const hookPrompt = `Based on this research about ${contact.companyName}, identify the SINGLE most compelling angle for reaching out about ${product.name}.

Research:
${enrichmentSummary}

Product pain points we solve:
${product.painPoints.join("\n")}

Return a JSON object with exactly these fields:
- hook: One specific observation about their company (not generic, reference actual research)
- angle: Which pain point from the list this connects to
- proofPoint: A specific detail from the research that supports the hook

Example output:
{
  "hook": "They just raised Series B and are hiring 12 engineers",
  "angle": "Shipping slower than competitors",
  "proofPoint": "Job posting mentions 'rapid iteration' and 'tight deadlines'"
}

Return ONLY the JSON object, no other text.`;

  try {
    const response = await callClaude(
      "You extract the most compelling sales angles from company research. Return only valid JSON, no markdown formatting.",
      [{ role: "user", content: hookPrompt }],
      apiKey
    );

    // Clean potential markdown formatting
    const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback if parsing fails
    return {
      hook: "Based on your company's work",
      angle: product.painPoints[0] || "efficiency",
      proofPoint: "your recent activity",
    };
  }
}

function buildStructuredPrompt(
  product: Product,
  contact: { name: string; title: string; companyName: string; email: string },
  enrichmentSummary: string,
  extractedHook: ExtractedHook,
  templatePrompt?: string | null
): string {
  // Pick a random example to include (avoid showing same example every time)
  const example = product.fewShotExamples[
    Math.floor(Math.random() * product.fewShotExamples.length)
  ];

  return `Write a cold email following this EXACT structure:

1. **HOOK** (1 sentence): Reference something specific about their company
2. **BRIDGE** (1 sentence): Connect their situation to a common challenge
3. **VALUE** (1-2 sentences): What you offer + one proof point
4. **CTA** (1 sentence): Low-friction ask (question, not "let's hop on a call")

**Pre-identified hook to use:** "${extractedHook.hook}"
**Angle:** ${extractedHook.angle}
**Proof point from research:** ${extractedHook.proofPoint}

**Recipient:**
- Name: ${contact.name}
- Title: ${contact.title}
- Company: ${contact.companyName}
- Email: ${contact.email}

**Product context:**
- ${product.description}
- Key value: ${product.valueProps[0]}

**DO NOT use these phrases:**
${product.antiPatterns.slice(0, 8).map((p) => `- "${p}"`).join("\n")}

**Reference example (match this tone and structure):**
Context: ${example.context}
Hook used: ${example.hook}

SUBJECT: ${example.subject}
BODY:
${example.body}

---
${templatePrompt ? `**Additional context:** ${templatePrompt}\n\n---` : ""}

Now write the email for ${contact.name}. Format your response as:
SUBJECT: [subject line - max 50 chars, specific to their situation]
BODY:
[email body - under 150 words, following the 4-part structure]`;
}

// Draft emails for campaign contacts
export const draftCampaignEmails = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignId: string; contactIds?: string[] }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, data.campaignId),
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const product = getProduct(campaign.product as any);

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
      with: {
        contact: { with: { company: true } },
      },
    });

    const results = { drafted: 0, failed: 0, errors: [] as string[] };

    for (const cc of toDraft) {
      try {
        // Update to drafting
        await db
          .update(campaignContacts)
          .set({ stage: "drafting", updatedAt: new Date() })
          .where(eq(campaignContacts.id, cc.id));

        // Parse enrichment data
        const enrichment = cc.enrichmentData
          ? JSON.parse(cc.enrichmentData)
          : null;

        const enrichmentSummary = enrichment?.results
          ?.map((r: any) =>
            // Prefer summary > highlights > text
            r.summary || r.highlights?.join(" ") || r.text?.substring(0, 500)
          )
          .filter(Boolean)
          .join("\n\n") || "No research data available.";

        // Build contact info
        const contactName = [cc.contact.firstName, cc.contact.lastName]
          .filter(Boolean)
          .join(" ") || "there";
        const companyName = cc.contact.company?.name || "their company";

        const contactInfo = {
          name: contactName,
          title: cc.contact.title || "Unknown",
          companyName,
          email: cc.contact.email,
        };

        // Step 1: Extract the hook
        const extractedHook = await extractHook(
          enrichmentSummary,
          product,
          contactInfo,
          env.ANTHROPIC_API_KEY
        );

        // Step 2: Build structured prompt with hook and examples
        const userPrompt = buildStructuredPrompt(
          product,
          contactInfo,
          enrichmentSummary,
          extractedHook,
          campaign.templatePrompt
        );

        const response = await callClaude(
          product.emailSystemPrompt,
          [{ role: "user", content: userPrompt }],
          env.ANTHROPIC_API_KEY
        );

        const { subject, body } = parseEmailResponse(response);

        // Update with draft and hook
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

        await db.insert(activities).values({
          contactId: cc.contactId,
          campaignId: data.campaignId,
          type: "draft_created",
          metadata: JSON.stringify({
            hook: extractedHook.hook,
            angle: extractedHook.angle,
          }),
        });

        results.drafted++;
      } catch (e) {
        await db
          .update(campaignContacts)
          .set({ stage: "enriched", updatedAt: new Date() })
          .where(eq(campaignContacts.id, cc.id));

        results.failed++;
        results.errors.push(
          `${cc.contact.email}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return results;
  });

// Regenerate a single draft with optional feedback
export const regenerateDraft = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignContactId: string; feedback?: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const cc = await db.query.campaignContacts.findFirst({
      where: eq(campaignContacts.id, data.campaignContactId),
      with: {
        contact: { with: { company: true } },
        campaign: true,
      },
    });

    if (!cc) {
      throw new Error("Campaign contact not found");
    }

    const product = getProduct(cc.campaign.product as any);
    const enrichment = cc.enrichmentData ? JSON.parse(cc.enrichmentData) : null;

    const enrichmentSummary = enrichment?.results
      ?.map((r: any) => r.summary || r.highlights?.join(" ") || r.text?.substring(0, 500))
      .filter(Boolean)
      .join("\n\n") || "No research data available.";

    const contactName = [cc.contact.firstName, cc.contact.lastName]
      .filter(Boolean)
      .join(" ") || "there";

    let userPrompt: string;

    if (data.feedback && cc.draftSubject && cc.draftBody) {
      // Regenerate with feedback on existing draft
      userPrompt = `Here's a cold email draft that needs revision:

SUBJECT: ${cc.draftSubject}
BODY:
${cc.draftBody}

---

**Feedback to incorporate:** ${data.feedback}

**Context:**
- Recipient: ${contactName} at ${cc.contact.company?.name || "their company"}
- Product: ${product.name}

Please revise the email based on the feedback. Keep the same format:
SUBJECT: [subject line]
BODY:
[email body]`;
    } else {
      // Generate fresh draft
      userPrompt = `Write a NEW cold email (different from any previous version) for:

**Recipient:**
- Name: ${contactName}
- Title: ${cc.contact.title || "Unknown"}
- Company: ${cc.contact.company?.name || "their company"}

**Research:**
${enrichmentSummary}

**Product:** ${product.name}
- ${product.description}
- Value props: ${product.valueProps.join(", ")}

${cc.campaign.templatePrompt ? `**Additional context:** ${cc.campaign.templatePrompt}` : ""}

Format:
SUBJECT: [subject line]
BODY:
[email body]`;
    }

    const response = await callClaude(
      product.emailSystemPrompt,
      [{ role: "user", content: userPrompt }],
      env.ANTHROPIC_API_KEY
    );

    const { subject, body } = parseEmailResponse(response);

    // Update draft with regeneration tracking
    await db
      .update(campaignContacts)
      .set({
        draftSubject: subject,
        draftBody: body,
        regenerationCount: sql`${campaignContacts.regenerationCount} + 1`,
        lastFeedback: data.feedback || null,
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, data.campaignContactId));

    // Log regeneration activity with feedback
    await db.insert(activities).values({
      contactId: cc.contactId,
      campaignId: cc.campaignId,
      type: "draft_regenerated",
      metadata: JSON.stringify({
        feedback: data.feedback || null,
        regenerationNumber: (cc.regenerationCount || 0) + 1,
        previousSubject: cc.draftSubject,
      }),
    });

    return { success: true, subject, body };
  });
