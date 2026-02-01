import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      signUp: {
        async beforeCreate({ email }) {
          // ALLOWED_EMAILS is a comma-separated list of emails
          const allowedEmailsRaw = env.ALLOWED_EMAILS || "";
          const allowedEmails = allowedEmailsRaw
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);

          if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
            throw new Error("Signups are restricted to invited users only");
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
