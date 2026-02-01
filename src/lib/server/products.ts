import { createServerFn } from "@tanstack/react-start";
import { eq, desc } from "drizzle-orm";
import { getDb, products, campaigns } from "@/lib/db";
import { getEnv } from "@/lib/env";

// Helper: Build enrichment query from template
export function buildEnrichmentQuery(
  template: string,
  companyName: string
): string {
  return template.replace(/\{\{companyName\}\}/g, companyName);
}

// Get all products
export const getProducts = createServerFn({ method: "GET" }).handler(
  async () => {
    const env = getEnv();
    const db = getDb(env.DB);
    const result = await db.query.products.findMany({
      orderBy: [desc(products.isDefault), desc(products.createdAt)],
    });
    return result;
  }
);

// Get single product
export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);
    return db.query.products.findFirst({
      where: eq(products.id, data.id),
    });
  });

// Create product
export const createProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      description: string;
      valueProps: string[];
      targetAudience: string;
      enrichmentQueryTemplate: string;
      emailSystemPrompt: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const [product] = await db
      .insert(products)
      .values({
        name: data.name,
        description: data.description,
        valueProps: JSON.stringify(data.valueProps),
        targetAudience: data.targetAudience,
        enrichmentQueryTemplate: data.enrichmentQueryTemplate,
        emailSystemPrompt: data.emailSystemPrompt,
        isDefault: false,
      })
      .returning();

    return product;
  });

// Update product
export const updateProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      name?: string;
      description?: string;
      valueProps?: string[];
      targetAudience?: string;
      enrichmentQueryTemplate?: string;
      emailSystemPrompt?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const { id, valueProps, ...rest } = data;
    const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (valueProps) {
      updates.valueProps = JSON.stringify(valueProps);
    }

    const [product] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();

    return product;
  });

// Delete product (only non-default, with campaign check)
export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Check if product is default
    const product = await db.query.products.findFirst({
      where: eq(products.id, data.id),
    });

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.isDefault) {
      throw new Error("Cannot delete default products");
    }

    // Check if product is used by any campaigns
    const campaignsUsingProduct = await db.query.campaigns.findMany({
      where: eq(campaigns.product, data.id),
      limit: 1,
    });

    if (campaignsUsingProduct.length > 0) {
      throw new Error("Cannot delete product that is used by campaigns");
    }

    await db.delete(products).where(eq(products.id, data.id));
    return { success: true };
  });

// Shared anti-patterns for all products
const sharedAntiPatterns = [
  "I hope this email finds you well",
  "I wanted to reach out",
  "I came across your company",
  "Just following up",
  "Do you have 15 minutes",
  "I'd love to pick your brain",
  "game-changer",
  "industry-leading",
  "best-in-class",
  "synergy",
  "leverage",
  "touch base",
  "circle back",
  "low-hanging fruit",
  "move the needle",
];

// Seed default products (for migration)
export const seedDefaultProducts = createServerFn({ method: "POST" }).handler(
  async () => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Check if products already exist
    const existing = await db.query.products.findMany({ limit: 1 });
    if (existing.length > 0) {
      return { seeded: false, message: "Products already exist" };
    }

    const defaultProducts = [
      {
        id: "file-logic",
        name: "File Logic",
        description:
          "HIPAA-compliant document processing platform that automates medical record analysis for Social Security disability law firms. Uses AI to extract key medical evidence, timeline events, and build case summaries.",
        valueProps: JSON.stringify([
          "Reduce medical record review time by 80%",
          "AI-powered extraction of key medical evidence",
          "Automatic timeline generation from records",
          "HIPAA-compliant and secure",
          "Integrates with FileVine and other case management systems",
        ]),
        targetAudience:
          "Social Security disability law firms handling high volume cases",
        enrichmentQueryTemplate:
          "{{companyName}} social security disability law firm case wins success rate growth hiring expansion",
        emailSystemPrompt: `You are an expert cold email copywriter for B2B SaaS. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA (question, not calendar link)

Structure every email as:
1. HOOK (1 sentence): Reference something specific about their company from research
2. BRIDGE (1 sentence): Connect their situation to a common challenge
3. VALUE (1-2 sentences): What you offer + one proof point
4. CTA (1 sentence): Low-friction ask like "Worth a look?" or "Want me to run a sample?"

Context: You're reaching out about File Logic, a HIPAA-compliant document processing platform for SS disability law firms. Focus on pain points around medical record review time, case preparation, and compliance.`,
        painPoints: JSON.stringify([
          "Medical record review taking too long",
          "Case backlog growing faster than capacity",
          "Manual timeline creation is tedious",
          "HIPAA compliance concerns with current workflow",
          "Staff turnover means constant retraining on record review",
          "Missing key medical evidence in records",
          "Hearings delayed due to incomplete case prep",
        ]),
        antiPatterns: JSON.stringify(sharedAntiPatterns),
        fewShotExamples: JSON.stringify([
          {
            context: "Law firm recently expanded to 3 new attorneys, handling 200+ cases/month",
            hook: "Their growth is outpacing capacity to review records",
            subject: "Quick question about your record review process",
            body: `Hi Sarah,

Saw you recently brought on 3 new attorneys - congrats on the growth.

With case volume climbing, I'm curious how your team's keeping up with medical record review. At 200+ cases/month, even small delays there can push back hearings.

We built File Logic specifically for SS disability firms - uses AI to pull key medical evidence and build timelines automatically. Most firms see review time drop by about 80%.

Would it help to see how it handles one of your case files?

Best,
[Name]`,
          },
          {
            context: "Firm mentioned backlog issues in recent news, 6+ month wait times",
            hook: "They're publicly struggling with case processing speed",
            subject: "Saw your case backlog mention",
            body: `Hi Mike,

Noticed the piece about your firm's 6-month backlog - sounds like you're dealing with serious volume.

A lot of that bottleneck usually traces back to medical record review. It's the slowest part of case prep for most SS disability firms.

File Logic automates that step - extracts key medical evidence and builds the timeline without manual review. Works with FileVine too.

Want me to run a sample case through so you can see the output?

Best,
[Name]`,
          },
        ]),
        isDefault: true,
      },
      {
        id: "consulting",
        name: "Design Engineering Consulting",
        description:
          "Technical consulting for startups and agencies who need high-quality UI/UX implementation. Specializing in Next.js, React, and AI-integrated applications.",
        valueProps: JSON.stringify([
          "Ship faster with a design engineer who codes",
          "Bridge the gap between design and development",
          "AI-first development workflows",
          "Rapid prototyping and iteration",
        ]),
        targetAudience:
          "Startups and agencies needing high-quality frontend work",
        enrichmentQueryTemplate:
          "{{companyName}} startup funding launch product redesign hiring engineers",
        emailSystemPrompt: `You are an expert cold email copywriter for B2B services. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA (question, not calendar link)

Structure every email as:
1. HOOK (1 sentence): Reference something specific about their company from research
2. BRIDGE (1 sentence): Connect their situation to a common challenge
3. VALUE (1-2 sentences): What you offer + one proof point
4. CTA (1 sentence): Low-friction ask

Context: You're reaching out about design engineering consulting services. Focus on shipping speed, design quality, and bridging the gap between design and development.`,
        painPoints: JSON.stringify([
          "Designers and developers not on the same page",
          "Shipping slower than competitors",
          "Can't find senior frontend talent",
          "Product looks dated compared to competitors",
          "Technical debt slowing down new features",
          "Need to launch fast after funding",
          "Agency capacity maxed out",
        ]),
        antiPatterns: JSON.stringify(sharedAntiPatterns),
        fewShotExamples: JSON.stringify([
          {
            context: "Startup just raised Series A, job posting for frontend engineer",
            hook: "They just got funded and need to ship fast",
            subject: "Saw your Series A news",
            body: `Hi Alex,

Congrats on the Series A - saw you're hiring frontend engineers now.

The post-funding scramble to ship faster is real. Finding senior React talent takes months, and you probably don't have months.

I'm a design engineer who works with post-seed startups - bridge the gap while you build the team. Last client went from Figma to production in 3 weeks.

Worth a quick chat about your roadmap?

Best,
[Name]`,
          },
          {
            context: "Agency with growing client list, looking to expand capacity",
            hook: "They're capacity constrained with growing demand",
            subject: "Quick question about your dev capacity",
            body: `Hi Jordan,

Noticed you've added several new clients recently - nice growth.

Curious if you're running into capacity issues on the frontend side? A lot of agencies hit a ceiling where they're turning away work or missing deadlines.

I partner with agencies as overflow capacity - senior React/Next.js work without the hiring overhead. Just wrapped a project with [similar agency] that freed up their team for strategy.

Open to exploring?

Best,
[Name]`,
          },
        ]),
        isDefault: true,
      },
      {
        id: "offerarc",
        name: "OfferArc",
        description:
          "AI-powered Facebook ad generation tool. Creates high-converting ad copy and creative concepts based on your offer and audience.",
        valueProps: JSON.stringify([
          "Generate dozens of ad variations in minutes",
          "AI trained on high-performing ad patterns",
          "A/B test copy and angles at scale",
        ]),
        targetAudience:
          "Media buyers and marketing agencies running Facebook ads",
        enrichmentQueryTemplate:
          "{{companyName}} facebook ads agency clients ROAS performance results case study",
        emailSystemPrompt: `You are an expert cold email copywriter for B2B SaaS. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA (question, not calendar link)

Structure every email as:
1. HOOK (1 sentence): Reference something specific about their company from research
2. BRIDGE (1 sentence): Connect their situation to a common challenge
3. VALUE (1-2 sentences): What you offer + one proof point
4. CTA (1 sentence): Low-friction ask

Context: You're reaching out about OfferArc, an AI ad generation tool for media buyers. Focus on creative testing velocity, ad fatigue, and scaling challenges.`,
        painPoints: JSON.stringify([
          "Creative fatigue killing ROAS",
          "Can't test enough ad variations",
          "Copywriters can't keep up with demand",
          "Scaling accounts hitting creative ceiling",
          "Manual ad creation taking too long",
          "Winners burning out faster than replacements come in",
          "CPMs rising, need better creative to compensate",
        ]),
        antiPatterns: JSON.stringify(sharedAntiPatterns),
        fewShotExamples: JSON.stringify([
          {
            context: "Agency running ads for e-commerce clients, mentions scaling challenges",
            hook: "They're hitting creative fatigue at scale",
            subject: "Quick question about your creative testing",
            body: `Hi Marcus,

Saw you're scaling several e-commerce accounts - nice work on the DTC brand case study.

Curious how you're keeping up with creative testing at that volume? Most buyers I talk to hit a wall where they can't produce variations fast enough to beat fatigue.

OfferArc generates dozens of ad copy variations in minutes - trained on patterns from high-performing campaigns. One agency went from 10 to 50+ tests per week without adding headcount.

Worth seeing how it handles your offers?

Best,
[Name]`,
          },
          {
            context: "Solo media buyer with growing client roster, active on Twitter about ads",
            hook: "They're capacity constrained as a solo operator",
            subject: "Saw your thread on creative velocity",
            body: `Hi Taylor,

Your thread on creative testing velocity hit home - you're right that most buyers undertest.

The bottleneck is usually production, not ideas. Hard to run 30 variations when you're also managing clients.

Built OfferArc for exactly this - takes your winning angles and spins up dozens of variations in minutes. Frees up your time for strategy instead of copywriting.

Want to try it on one of your offers?

Best,
[Name]`,
          },
        ]),
        isDefault: true,
      },
    ];

    await db.insert(products).values(defaultProducts);

    return { seeded: true, count: defaultProducts.length };
  }
);

// Update existing default products with new fields (one-time migration helper)
export const updateDefaultProductFields = createServerFn({ method: "POST" }).handler(
  async () => {
    const env = getEnv();
    const db = getDb(env.DB);

    const updates = [
      {
        id: "file-logic",
        painPoints: JSON.stringify([
          "Medical record review taking too long",
          "Case backlog growing faster than capacity",
          "Manual timeline creation is tedious",
          "HIPAA compliance concerns with current workflow",
          "Staff turnover means constant retraining on record review",
          "Missing key medical evidence in records",
          "Hearings delayed due to incomplete case prep",
        ]),
        antiPatterns: JSON.stringify(sharedAntiPatterns),
        fewShotExamples: JSON.stringify([
          {
            context: "Law firm recently expanded to 3 new attorneys, handling 200+ cases/month",
            hook: "Their growth is outpacing capacity to review records",
            subject: "Quick question about your record review process",
            body: `Hi Sarah,

Saw you recently brought on 3 new attorneys - congrats on the growth.

With case volume climbing, I'm curious how your team's keeping up with medical record review. At 200+ cases/month, even small delays there can push back hearings.

We built File Logic specifically for SS disability firms - uses AI to pull key medical evidence and build timelines automatically. Most firms see review time drop by about 80%.

Would it help to see how it handles one of your case files?

Best,
[Name]`,
          },
          {
            context: "Firm mentioned backlog issues in recent news, 6+ month wait times",
            hook: "They're publicly struggling with case processing speed",
            subject: "Saw your case backlog mention",
            body: `Hi Mike,

Noticed the piece about your firm's 6-month backlog - sounds like you're dealing with serious volume.

A lot of that bottleneck usually traces back to medical record review. It's the slowest part of case prep for most SS disability firms.

File Logic automates that step - extracts key medical evidence and builds the timeline without manual review. Works with FileVine too.

Want me to run a sample case through so you can see the output?

Best,
[Name]`,
          },
        ]),
      },
      {
        id: "consulting",
        painPoints: JSON.stringify([
          "Designers and developers not on the same page",
          "Shipping slower than competitors",
          "Can't find senior frontend talent",
          "Product looks dated compared to competitors",
          "Technical debt slowing down new features",
          "Need to launch fast after funding",
          "Agency capacity maxed out",
        ]),
        antiPatterns: JSON.stringify(sharedAntiPatterns),
        fewShotExamples: JSON.stringify([
          {
            context: "Startup just raised Series A, job posting for frontend engineer",
            hook: "They just got funded and need to ship fast",
            subject: "Saw your Series A news",
            body: `Hi Alex,

Congrats on the Series A - saw you're hiring frontend engineers now.

The post-funding scramble to ship faster is real. Finding senior React talent takes months, and you probably don't have months.

I'm a design engineer who works with post-seed startups - bridge the gap while you build the team. Last client went from Figma to production in 3 weeks.

Worth a quick chat about your roadmap?

Best,
[Name]`,
          },
          {
            context: "Agency with growing client list, looking to expand capacity",
            hook: "They're capacity constrained with growing demand",
            subject: "Quick question about your dev capacity",
            body: `Hi Jordan,

Noticed you've added several new clients recently - nice growth.

Curious if you're running into capacity issues on the frontend side? A lot of agencies hit a ceiling where they're turning away work or missing deadlines.

I partner with agencies as overflow capacity - senior React/Next.js work without the hiring overhead. Just wrapped a project with [similar agency] that freed up their team for strategy.

Open to exploring?

Best,
[Name]`,
          },
        ]),
      },
      {
        id: "offerarc",
        painPoints: JSON.stringify([
          "Creative fatigue killing ROAS",
          "Can't test enough ad variations",
          "Copywriters can't keep up with demand",
          "Scaling accounts hitting creative ceiling",
          "Manual ad creation taking too long",
          "Winners burning out faster than replacements come in",
          "CPMs rising, need better creative to compensate",
        ]),
        antiPatterns: JSON.stringify(sharedAntiPatterns),
        fewShotExamples: JSON.stringify([
          {
            context: "Agency running ads for e-commerce clients, mentions scaling challenges",
            hook: "They're hitting creative fatigue at scale",
            subject: "Quick question about your creative testing",
            body: `Hi Marcus,

Saw you're scaling several e-commerce accounts - nice work on the DTC brand case study.

Curious how you're keeping up with creative testing at that volume? Most buyers I talk to hit a wall where they can't produce variations fast enough to beat fatigue.

OfferArc generates dozens of ad copy variations in minutes - trained on patterns from high-performing campaigns. One agency went from 10 to 50+ tests per week without adding headcount.

Worth seeing how it handles your offers?

Best,
[Name]`,
          },
          {
            context: "Solo media buyer with growing client roster, active on Twitter about ads",
            hook: "They're capacity constrained as a solo operator",
            subject: "Saw your thread on creative velocity",
            body: `Hi Taylor,

Your thread on creative testing velocity hit home - you're right that most buyers undertest.

The bottleneck is usually production, not ideas. Hard to run 30 variations when you're also managing clients.

Built OfferArc for exactly this - takes your winning angles and spins up dozens of variations in minutes. Frees up your time for strategy instead of copywriting.

Want to try it on one of your offers?

Best,
[Name]`,
          },
        ]),
      },
    ];

    let updated = 0;
    for (const update of updates) {
      const result = await db
        .update(products)
        .set({
          painPoints: update.painPoints,
          antiPatterns: update.antiPatterns,
          fewShotExamples: update.fewShotExamples,
          updatedAt: new Date(),
        })
        .where(eq(products.id, update.id));

      if (result.rowsAffected > 0) {
        updated++;
      }
    }

    return { updated };
  }
);
