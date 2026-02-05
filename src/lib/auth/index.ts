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
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            // First user gets admin role set BEFORE insertion
            // so the session is created with the correct role
            const result = await db
              .select({ count: sql<number>`count(*)` })
              .from(schema.users);
            if (result[0].count === 0) {
              return { data: { ...user, role: "admin" } };
            }
            return { data: user };
          },
          async after(user) {
            // Mark invite as accepted for non-first users
            const result = await db
              .select({ count: sql<number>`count(*)` })
              .from(schema.users);
            if (result[0].count > 1) {
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
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      signUp: {
        async beforeCreate({ email }) {
          // Check if this is the first user (they're allowed automatically)
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.users);
          if (result[0].count === 0) return;

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
