import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq, sql, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

export function getAuth() {
  const env = getEnv();
  const db = getDb(env.DB);

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "member",
          input: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      signUp: {
        async beforeCreate({ email }) {
          // Check if this is the first user (they become admin automatically)
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.users);
          const isFirstUser = result[0].count === 0;

          if (isFirstUser) {
            // First user is allowed — they'll be set as admin in afterCreate
            return;
          }

          // Otherwise, require a valid invite for this email
          const invite = await db
            .select()
            .from(schema.invites)
            .where(
              and(
                eq(schema.invites.email, email.toLowerCase()),
                eq(schema.invites.status, "pending")
              )
            )
            .get();

          if (!invite || new Date() > invite.expiresAt) {
            throw new Error(
              "Signups are invite-only. Ask your admin for an invite link."
            );
          }
        },
        async afterCreate({ user }) {
          // Check if this is the first user — make them admin
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.users);
          const isFirstUser = result[0].count === 1;

          if (isFirstUser) {
            await db
              .update(schema.users)
              .set({ role: "admin" })
              .where(eq(schema.users.id, user.id));
          } else {
            // Mark the invite as accepted
            await db
              .update(schema.invites)
              .set({
                status: "accepted",
                acceptedAt: new Date(),
              })
              .where(
                and(
                  eq(schema.invites.email, user.email.toLowerCase()),
                  eq(schema.invites.status, "pending")
                )
              );
          }
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    plugins: [tanstackStartCookies()], // Must be last plugin
  });
}

export type Auth = ReturnType<typeof getAuth>;
