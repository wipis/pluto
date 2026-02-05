import { createServerFn } from "@tanstack/react-start";
import { eq, like } from "drizzle-orm";
import { getDb, contacts, companies, activities, campaignContacts } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { importContactsInput, parseCSVInput } from "@/lib/validation";

interface CSVRow {
  firstName?: string;
  lastName?: string;
  email: string;
  company?: string;
  domain?: string;
  title?: string;
  linkedinUrl?: string;
  phone?: string;
}

// Import contacts from CSV data
export const importContacts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => importContactsInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Cache for company lookups/creation
    const companyCache = new Map<string, string>();

    for (const row of data.rows) {
      try {
        // Validate email
        if (!row.email || !row.email.includes("@")) {
          results.errors.push(`Invalid email: ${row.email}`);
          continue;
        }

        // Check if email already exists
        const existing = await db.query.contacts.findFirst({
          where: eq(contacts.email, row.email.toLowerCase().trim()),
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Get or create company
        let companyId: string | undefined;
        const companyKey = row.company || row.domain;

        if (companyKey) {
          if (companyCache.has(companyKey)) {
            companyId = companyCache.get(companyKey);
          } else {
            // Try to find existing company by domain first
            let company = row.domain
              ? await db.query.companies.findFirst({
                  where: eq(companies.domain, row.domain.toLowerCase().trim()),
                })
              : null;

            // If not found by domain, try by name
            if (!company && row.company) {
              company = await db.query.companies.findFirst({
                where: like(companies.name, row.company.trim()),
              });
            }

            // Create if not found
            if (!company) {
              const [newCompany] = await db
                .insert(companies)
                .values({
                  name: row.company || row.domain || "Unknown",
                  domain: row.domain?.toLowerCase().trim(),
                })
                .returning();
              company = newCompany;
            }

            companyId = company.id;
            companyCache.set(companyKey, company.id);
          }
        }

        // Extract domain from email if no company
        if (!companyId) {
          const emailDomain = row.email.split("@")[1]?.toLowerCase();
          if (emailDomain && !emailDomain.includes("gmail") && !emailDomain.includes("yahoo") && !emailDomain.includes("hotmail")) {
            const domainKey = emailDomain;
            if (companyCache.has(domainKey)) {
              companyId = companyCache.get(domainKey);
            } else {
              let company = await db.query.companies.findFirst({
                where: eq(companies.domain, emailDomain),
              });

              if (!company) {
                const [newCompany] = await db
                  .insert(companies)
                  .values({
                    name: emailDomain.split(".")[0],
                    domain: emailDomain,
                  })
                  .returning();
                company = newCompany;
              }

              companyId = company.id;
              companyCache.set(domainKey, company.id);
            }
          }
        }

        // Create contact
        const [contact] = await db
          .insert(contacts)
          .values({
            firstName: row.firstName?.trim(),
            lastName: row.lastName?.trim(),
            email: row.email.toLowerCase().trim(),
            companyId,
            title: row.title?.trim(),
            linkedinUrl: row.linkedinUrl?.trim(),
            phone: row.phone?.trim(),
          })
          .returning();

        // Log activity
        await db.insert(activities).values({
          contactId: contact.id,
          type: "contact_created",
          metadata: JSON.stringify({ source: "csv_import" }),
        });

        // Add to campaign if specified
        if (data.campaignId) {
          await db.insert(campaignContacts).values({
            campaignId: data.campaignId,
            contactId: contact.id,
            stage: "new",
          });

          await db.insert(activities).values({
            contactId: contact.id,
            campaignId: data.campaignId,
            type: "added_to_campaign",
          });
        }

        results.created++;
      } catch (e) {
        results.errors.push(
          `Row ${row.email}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return results;
  });

// Parse CSV text into rows
export const parseCSV = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseCSVInput.parse(data))
  .handler(async ({ data }) => {
    const lines = data.csvText.trim().split("\n");
    if (lines.length < 2) {
      return { rows: [], headers: [] };
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        const mappedField = data.columnMapping[header];
        if (mappedField && values[idx]) {
          row[mappedField] = values[idx];
        }
      });

      if (row.email) {
        rows.push(row as CSVRow);
      }
    }

    return { rows, headers };
  });
