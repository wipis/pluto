import { createServerFn } from "@tanstack/react-start";
import { eq, desc } from "drizzle-orm";
import { getDb, gmailTokens } from "@/lib/db";
import { getEnv } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface UserInfo {
  email: string;
}

export function generateAuthUrl(redirectUri: string, origin: string): string {
  const env = getEnv();

  // Encode origin in state parameter to use in callback
  const state = btoa(JSON.stringify({ origin }));

  const params = new URLSearchParams({
    client_id: env.GMAIL_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const env = getEnv();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const env = getEnv();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get user info");
  }

  const data: UserInfo = await response.json();
  return data.email;
}

export async function getValidAccessToken(accountId?: string): Promise<string> {
  const env = getEnv();
  const db = getDb(env.DB);

  // Get specific account or first available
  const tokens = accountId
    ? await db.query.gmailTokens.findFirst({
        where: eq(gmailTokens.id, accountId),
      })
    : await db.query.gmailTokens.findFirst({
        orderBy: [desc(gmailTokens.createdAt)],
      });

  if (!tokens) {
    throw new Error("Gmail not connected. Please connect Gmail in Settings.");
  }

  // Check if token expires in next 5 minutes
  const expiresAt = new Date(tokens.expiresAt);
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - Date.now() > bufferTime) {
    return tokens.accessToken;
  }

  // Token expired or expiring soon - refresh it
  const newTokens = await refreshAccessToken(tokens.refreshToken);

  // Update in database
  await db
    .update(gmailTokens)
    .set({
      accessToken: newTokens.access_token,
      expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(gmailTokens.id, tokens.id));

  return newTokens.access_token;
}

export async function saveTokens(
  tokens: TokenResponse,
  userEmail: string
): Promise<string> {
  const env = getEnv();
  const db = getDb(env.DB);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Please try connecting again.");
  }

  // Always insert a new account (supports multiple accounts)
  const [newAccount] = await db
    .insert(gmailTokens)
    .values({
      userEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    })
    .returning();

  return newAccount.id;
}

// Get all connected Gmail accounts
export const getGmailAccounts = createServerFn({ method: "GET" }).handler(
  async () => {
    const env = getEnv();
    const db = getDb(env.DB);

    const accounts = await db.query.gmailTokens.findMany({
      columns: {
        id: true,
        userEmail: true,
        label: true,
        createdAt: true,
      },
      orderBy: [desc(gmailTokens.createdAt)],
    });

    return accounts;
  }
);

// Delete a Gmail account
export const deleteGmailAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    await db.delete(gmailTokens).where(eq(gmailTokens.id, data.accountId));

    return { success: true };
  });

// Update account label
export const updateAccountLabel = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string; label: string }) => data)
  .handler(async ({ data }) => {
    const env = getEnv();
    const db = getDb(env.DB);

    await db
      .update(gmailTokens)
      .set({ label: data.label, updatedAt: new Date() })
      .where(eq(gmailTokens.id, data.accountId));

    return { success: true };
  });
