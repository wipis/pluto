export type ProductId = "file-logic" | "consulting" | "offerarc";

export interface Product {
  id: ProductId;
  name: string;
  description: string;
  valueProps: string[];
  targetAudience: string;
  enrichmentQuery: (companyName: string) => string;
  emailSystemPrompt: string;
}

export const products: Record<ProductId, Product> = {
  "file-logic": {
    id: "file-logic",
    name: "File Logic",
    description:
      "HIPAA-compliant document processing platform that automates medical record analysis for Social Security disability law firms. Uses AI to extract key medical evidence, timeline events, and build case summaries.",
    valueProps: [
      "Reduce medical record review time by 80%",
      "AI-powered extraction of key medical evidence",
      "Automatic timeline generation from records",
      "HIPAA-compliant and secure",
      "Integrates with FileVine and other case management systems",
    ],
    targetAudience:
      "Social Security disability law firms handling high volume cases",
    enrichmentQuery: (companyName: string) =>
      `${companyName} social security disability law firm case results attorneys`,
    emailSystemPrompt: `You are an expert cold email copywriter. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA

You write emails that feel like they're from a real person who did their homework, not a mass email blast.

Context: You're reaching out about File Logic, a HIPAA-compliant document processing platform for SS disability law firms. Focus on pain points around medical record review time, case preparation, and compliance.`,
  },
  consulting: {
    id: "consulting",
    name: "Design Engineering Consulting",
    description:
      "Technical consulting for startups and agencies who need high-quality UI/UX implementation. Specializing in Next.js, React, and AI-integrated applications.",
    valueProps: [
      "Ship faster with a design engineer who codes",
      "Bridge the gap between design and development",
      "AI-first development workflows",
      "Rapid prototyping and iteration",
    ],
    targetAudience: "Startups and agencies needing high-quality frontend work",
    enrichmentQuery: (companyName: string) =>
      `${companyName} startup company product technology`,
    emailSystemPrompt: `You are an expert cold email copywriter. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA

You write emails that feel like they're from a real person who did their homework, not a mass email blast.

Context: You're reaching out about design engineering consulting services. Focus on shipping speed, design quality, and bridging the gap between design and development.`,
  },
  offerarc: {
    id: "offerarc",
    name: "OfferArc",
    description:
      "AI-powered Facebook ad generation tool. Creates high-converting ad copy and creative concepts based on your offer and audience.",
    valueProps: [
      "Generate dozens of ad variations in minutes",
      "AI trained on high-performing ad patterns",
      "A/B test copy and angles at scale",
    ],
    targetAudience: "Media buyers and marketing agencies running Facebook ads",
    enrichmentQuery: (companyName: string) =>
      `${companyName} marketing agency facebook ads clients`,
    emailSystemPrompt: `You are an expert cold email copywriter. Your emails are:
- Concise (under 150 words for the body)
- Personalized based on research about the recipient
- Value-focused, not feature-focused
- Written in a casual, human tone
- Free of corporate jargon and buzzwords
- Include a soft, low-friction CTA

You write emails that feel like they're from a real person who did their homework, not a mass email blast.

Context: You're reaching out about OfferArc, an AI ad generation tool for media buyers. Focus on creative testing velocity, ad fatigue, and scaling challenges.`,
  },
};

export function getProduct(id: ProductId): Product {
  return products[id];
}

export function getProductList(): Product[] {
  return Object.values(products);
}

export function isValidProductId(id: string): id is ProductId {
  return id in products;
}
