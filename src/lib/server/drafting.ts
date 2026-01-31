import { createServerFn } from "@tanstack/react-start";
import { eq, and, inArray } from "drizzle-orm";
import { getDb, campaignContacts, campaigns, activities, products } from "@/lib/db";
import { getEnv } from "@/lib/env";

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

    const product = await db.query.products.findFirst({
      where: eq(products.id, campaign.product),
    });

    if (!product) {
      throw new Error("Product not found for campaign");
    }

    let valueProps: string[] = [];
    try {
      valueProps = JSON.parse(product.valueProps);
    } catch {
      console.error(`Invalid valueProps JSON for product ${product.id}`);
    }

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
            r.highlights?.join(" ") || r.text?.substring(0, 500)
          )
          .filter(Boolean)
          .join("\n\n") || "No research data available.";

        // Build prompt
        const contactName = [cc.contact.firstName, cc.contact.lastName]
          .filter(Boolean)
          .join(" ") || "there";
        const companyName = cc.contact.company?.name || "their company";

        const userPrompt = `Write a cold email for the following:

**Recipient:**
- Name: ${contactName}
- Title: ${cc.contact.title || "Unknown"}
- Company: ${companyName}
- Email: ${cc.contact.email}

**Research on their company:**
${enrichmentSummary}

**What I'm reaching out about:**
- Product: ${product.name}
- Description: ${product.description}
- Key value props: ${valueProps.join(", ")}
- Target audience: ${product.targetAudience}

${campaign.templatePrompt ? `**Additional context:** ${campaign.templatePrompt}` : ""}

Write the email with a subject line. Be specific about their company/situation based on the research. Make the connection between their needs and what I offer feel natural, not forced.

Format your response as:
SUBJECT: [subject line]
BODY:
[email body]`;

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
            updatedAt: new Date(),
          })
          .where(eq(campaignContacts.id, cc.id));

        await db.insert(activities).values({
          contactId: cc.contactId,
          campaignId: data.campaignId,
          type: "draft_created",
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

    const product = await db.query.products.findFirst({
      where: eq(products.id, cc.campaign.product),
    });

    if (!product) {
      throw new Error("Product not found for campaign");
    }

    let productValueProps: string[] = [];
    try {
      productValueProps = JSON.parse(product.valueProps);
    } catch {
      console.error(`Invalid valueProps JSON for product ${product.id}`);
    }
    const enrichment = cc.enrichmentData ? JSON.parse(cc.enrichmentData) : null;

    const enrichmentSummary = enrichment?.results
      ?.map((r: any) => r.highlights?.join(" ") || r.text?.substring(0, 500))
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
- Value props: ${productValueProps.join(", ")}

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

    await db
      .update(campaignContacts)
      .set({
        draftSubject: subject,
        draftBody: body,
        updatedAt: new Date(),
      })
      .where(eq(campaignContacts.id, data.campaignContactId));

    return { success: true, subject, body };
  });
