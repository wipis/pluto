import { createServerFn } from "@tanstack/react-start";
import { eq, sql, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/server/auth";
import * as schema from "@/lib/db/schema";
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  validateInviteTokenInput,
  createInviteInput,
  revokeInviteInput,
  removeUserInput,
} from "@/lib/validation";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new AuthError("Unauthorized");
  if (session.user.role !== "admin") throw new ForbiddenError("Admin access required");
  return session;
}

export const checkIsFirstUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const env = getEnv();
    const db = getDb(env.DB);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users);
    return result[0].count === 0;
  }
);

export const validateInviteToken = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => validateInviteTokenInput.parse(data))
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    const invite = await db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.token, data.token))
      .get();

    if (!invite) return { valid: false as const, error: "Invalid invite link" };
    if (invite.status !== "pending")
      return { valid: false as const, error: "This invite has already been used" };
    if (new Date() > invite.expiresAt)
      return { valid: false as const, error: "This invite has expired" };

    return { valid: true as const, email: invite.email };
  });

export const createInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createInviteInput.parse(data))
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const env = getEnv();
    const db = getDb(env.DB);

    const email = data.email.trim().toLowerCase();

    // Check if user already exists
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();
    if (existing) throw new ValidationError("A user with this email already exists");

    // Check for existing pending invite
    const existingInvite = await db
      .select()
      .from(schema.invites)
      .where(
        and(
          eq(schema.invites.email, email),
          eq(schema.invites.status, "pending")
        )
      )
      .get();
    if (existingInvite && new Date() < existingInvite.expiresAt) {
      return { token: existingInvite.token };
    }

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(schema.invites).values({
      email,
      token,
      invitedBy: session.user.id,
      expiresAt,
    });

    await db.insert(schema.activities).values({
      type: "user_invited",
      metadata: JSON.stringify({
        email,
        invitedBy: session.user.email,
      }),
    });

    return { token };
  });

export const listInvites = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireAdmin();
    const env = getEnv();
    const db = getDb(env.DB);

    return db
      .select()
      .from(schema.invites)
      .orderBy(desc(schema.invites.createdAt));
  }
);

export const revokeInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => revokeInviteInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const env = getEnv();
    const db = getDb(env.DB);

    await db
      .update(schema.invites)
      .set({ status: "revoked" })
      .where(eq(schema.invites.id, data.id));
  });

export const listUsers = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireAdmin();
    const env = getEnv();
    const db = getDb(env.DB);

    return db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.createdAt);
  }
);

export const removeUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => removeUserInput.parse(data))
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const env = getEnv();
    const db = getDb(env.DB);

    if (data.id === session.user.id) {
      throw new ValidationError("You cannot remove yourself");
    }

    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, data.id))
      .get();
    if (!user) throw new NotFoundError("User", data.id);

    // Delete sessions first, then account, then user
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, data.id));
    await db
      .delete(schema.accounts)
      .where(eq(schema.accounts.userId, data.id));
    await db.delete(schema.users).where(eq(schema.users.id, data.id));

    await db.insert(schema.activities).values({
      type: "user_removed",
      metadata: JSON.stringify({
        removedEmail: user.email,
        removedBy: session.user.email,
      }),
    });
  });
