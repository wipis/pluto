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
          "{{companyName}} social security disability law firm case results attorneys",
        emailSystemPrompt: `You are an expert cold email copywriter. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA

You write emails that feel like they're from a real person who did their homework, not a mass email blast.

Context: You're reaching out about File Logic, a HIPAA-compliant document processing platform for SS disability law firms. Focus on pain points around medical record review time, case preparation, and compliance.`,
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
          "{{companyName}} startup company product technology",
        emailSystemPrompt: `You are an expert cold email copywriter. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA

You write emails that feel like they're from a real person who did their homework, not a mass email blast.

Context: You're reaching out about design engineering consulting services. Focus on shipping speed, design quality, and bridging the gap between design and development.`,
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
          "{{companyName}} marketing agency facebook ads clients",
        emailSystemPrompt: `You are an expert cold email copywriter. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA

You write emails that feel like they're from a real person who did their homework, not a mass email blast.

Context: You're reaching out about OfferArc, an AI ad generation tool for media buyers. Focus on creative testing velocity, ad fatigue, and scaling challenges.`,
        isDefault: true,
      },
    ];

    await db.insert(products).values(defaultProducts);

    return { seeded: true, count: defaultProducts.length };
  }
);
