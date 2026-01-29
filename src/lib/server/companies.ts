import { createServerFn } from "@tanstack/react-start";
import { eq, like, desc, isNotNull, count, sql } from "drizzle-orm";
import { getDb, companies, contacts } from "@/lib/db";

// Get all companies with contact counts
export const getCompanies = createServerFn({ method: "GET" })
  .inputValidator(
    (data?: { search?: string; enriched?: boolean; limit?: number; offset?: number }) =>
      data ?? {}
  )
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const limit = data?.limit ?? 50;
    const offset = data?.offset ?? 0;

    let baseQuery = db
      .select({
        company: companies,
        contactCount: sql<number>`count(${contacts.id})`.as("contact_count"),
      })
      .from(companies)
      .leftJoin(contacts, eq(companies.id, contacts.companyId))
      .groupBy(companies.id)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);

    if (data?.search) {
      baseQuery = baseQuery.where(
        like(companies.name, `%${data.search}%`)
      );
    }

    if (data?.enriched !== undefined) {
      baseQuery = data.enriched
        ? baseQuery.where(isNotNull(companies.enrichedAt))
        : baseQuery.where(sql`${companies.enrichedAt} IS NULL`);
    }

    const results = await baseQuery;

    // Get total count
    const [{ total }] = await db.select({ total: count() }).from(companies);

    return {
      companies: results.map((r) => ({
        ...r.company,
        contactCount: r.contactCount,
      })),
      total,
    };
  });

// Get single company with contacts
export const getCompany = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, data.id),
      with: {
        contacts: {
          orderBy: desc(contacts.createdAt),
        },
      },
    });

    return company;
  });

// Create company
export const createCompany = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; domain?: string }) => data)
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const [company] = await db
      .insert(companies)
      .values({
        name: data.name,
        domain: data.domain,
      })
      .returning();

    return company;
  });

// Update company
export const updateCompany = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; name?: string; domain?: string }) => data)
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    const { id, ...updates } = data;

    const [company] = await db
      .update(companies)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id))
      .returning();

    return company;
  });

// Find or create company by domain
export const findOrCreateCompany = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; domain?: string }) => data)
  .handler(async ({ data }) => {
    const env = (globalThis as any).env as Cloudflare.Env;
    const db = getDb(env.DB);

    // Try to find by domain first if provided
    if (data.domain) {
      const existing = await db.query.companies.findFirst({
        where: eq(companies.domain, data.domain),
      });
      if (existing) return existing;
    }

    // Try to find by name
    const existingByName = await db.query.companies.findFirst({
      where: eq(companies.name, data.name),
    });
    if (existingByName) return existingByName;

    // Create new
    const [company] = await db
      .insert(companies)
      .values({
        name: data.name,
        domain: data.domain,
      })
      .returning();

    return company;
  });
