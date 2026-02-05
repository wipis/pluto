import { createServerFn } from "@tanstack/react-start";
import { eq, like, desc, or, count } from "drizzle-orm";
import { getDb, contacts, companies, activities, emails } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  getContactsInput,
  getContactInput,
  createContactInput,
  updateContactInput,
  deleteContactInput,
} from "@/lib/validation";

// Get all contacts with company info
export const getContacts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getContactsInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const limit = data?.limit ?? 50;
    const offset = data?.offset ?? 0;

    let baseQuery = db
      .select({
        contact: contacts,
        company: companies,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset);

    if (data?.search) {
      baseQuery = baseQuery.where(
        or(
          like(contacts.firstName, `%${data.search}%`),
          like(contacts.lastName, `%${data.search}%`),
          like(contacts.email, `%${data.search}%`),
          like(companies.name, `%${data.search}%`)
        )
      );
    }

    const results = await baseQuery;

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(contacts);

    return {
      contacts: results.map((r) => ({
        ...r.contact,
        company: r.company,
      })),
      total,
    };
  });

// Get single contact with full details
export const getContact = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getContactInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, data.id),
      with: {
        company: true,
        campaignContacts: {
          with: { campaign: true },
        },
        activities: {
          orderBy: desc(activities.createdAt),
          limit: 50,
        },
        emails: {
          orderBy: desc(emails.createdAt),
        },
      },
    });

    return contact;
  });

// Create contact
export const createContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createContactInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    let companyId = data.companyId;

    // Auto-create company if name provided but no ID
    if (!companyId && data.companyName) {
      const [company] = await db
        .insert(companies)
        .values({
          name: data.companyName,
          domain: data.domain,
        })
        .returning();
      companyId = company.id;
    }

    const [contact] = await db
      .insert(contacts)
      .values({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        companyId,
        title: data.title,
        linkedinUrl: data.linkedinUrl,
        phone: data.phone,
        notes: data.notes,
        tags: data.tags ? JSON.stringify(data.tags) : null,
      })
      .returning();

    // Log activity
    await db.insert(activities).values({
      contactId: contact.id,
      type: "contact_created",
      metadata: JSON.stringify({ source: "manual" }),
    });

    return contact;
  });

// Update contact
export const updateContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateContactInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const { id, tags, ...updates } = data;

    const [contact] = await db
      .update(contacts)
      .set({
        ...updates,
        tags: tags ? JSON.stringify(tags) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();

    await db.insert(activities).values({
      contactId: id,
      type: "contact_updated",
      metadata: JSON.stringify({ fields: Object.keys(updates) }),
    });

    return contact;
  });

// Delete contact
export const deleteContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteContactInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    await db.delete(contacts).where(eq(contacts.id, data.id));
    return { success: true };
  });
