import { createServerFn } from "@tanstack/react-start";
import { count, eq, desc, and, gte } from "drizzle-orm";
import {
  getDb,
  contacts,
  companies,
  campaigns,
  campaignContacts,
  activities,
} from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getContactActivitiesInput } from "@/lib/validation";

// Get dashboard stats
export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const env = getEnv();
    const db = getDb(env.DB);

    // Get counts
    const [contactCount] = await db.select({ count: count() }).from(contacts);
    const [companyCount] = await db.select({ count: count() }).from(companies);
    const [campaignCount] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.status, "active"));

    // Get pending review count (drafted stage)
    const [pendingReview] = await db
      .select({ count: count() })
      .from(campaignContacts)
      .where(eq(campaignContacts.stage, "drafted"));

    // Get this week's stats
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [sentThisWeek] = await db
      .select({ count: count() })
      .from(campaignContacts)
      .where(
        and(
          eq(campaignContacts.stage, "sent"),
          gte(campaignContacts.sentAt, oneWeekAgo)
        )
      );

    const [repliedThisWeek] = await db
      .select({ count: count() })
      .from(campaignContacts)
      .where(
        and(
          eq(campaignContacts.stage, "replied"),
          gte(campaignContacts.repliedAt, oneWeekAgo)
        )
      );

    // Get pipeline stats
    const pipelineStats = await db
      .select({
        stage: campaignContacts.stage,
        count: count(),
      })
      .from(campaignContacts)
      .groupBy(campaignContacts.stage);

    // Get recent activities
    const recentActivities = await db.query.activities.findMany({
      orderBy: desc(activities.createdAt),
      limit: 20,
      with: {
        contact: true,
        campaign: true,
      },
    });

    // Get recent campaigns
    const recentCampaigns = await db.query.campaigns.findMany({
      orderBy: desc(campaigns.createdAt),
      limit: 5,
    });

    return {
      totalContacts: contactCount.count,
      totalCompanies: companyCount.count,
      activeCampaigns: campaignCount.count,
      pendingReview: pendingReview.count,
      sentThisWeek: sentThisWeek.count,
      repliedThisWeek: repliedThisWeek.count,
      pipelineStats: Object.fromEntries(
        pipelineStats.map((s) => [s.stage, s.count])
      ),
      recentActivities,
      recentCampaigns,
    };
  }
);

// Get activity feed for a contact
export const getContactActivities = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getContactActivitiesInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const activityList = await db.query.activities.findMany({
      where: eq(activities.contactId, data.contactId),
      orderBy: desc(activities.createdAt),
      limit: data.limit ?? 50,
      with: {
        campaign: true,
      },
    });

    return activityList;
  });
