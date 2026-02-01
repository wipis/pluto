import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  exchangeCodeForTokens,
  getUserEmail,
  saveTokens,
} from "@/lib/server/gmail-auth";
import { createServerFn } from "@tanstack/react-start";

// Server function to handle OAuth callback
const handleGmailCallback = createServerFn({ method: "GET" })
  .inputValidator((data: { code?: string; error?: string; state?: string }) => data)
  .handler(async ({ data }) => {
    const { code, error, state } = data;

    // Decode origin from state parameter
    let origin = "http://localhost:3000"; // fallback
    if (state) {
      try {
        const decoded = JSON.parse(atob(state));
        origin = decoded.origin || origin;
      } catch {
        console.error("Failed to decode state parameter");
      }
    }

    // Handle OAuth errors
    if (error) {
      return { redirect: `/settings?error=${encodeURIComponent(error)}` };
    }

    if (!code) {
      return { redirect: `/settings?error=${encodeURIComponent("No authorization code received")}` };
    }

    try {
      // Build the redirect URI (must match what was used in the auth request)
      const redirectUri = `${origin}/api/auth/gmail/callback`;

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code, redirectUri);

      // Get user's email
      const userEmail = await getUserEmail(tokens.access_token);

      // Save tokens to database
      await saveTokens(tokens, userEmail);

      // Redirect to settings with success
      return { redirect: `/settings?success=gmail_connected` };
    } catch (err) {
      console.error("OAuth callback error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "OAuth callback failed";
      return { redirect: `/settings?error=${encodeURIComponent(errorMessage)}` };
    }
  });

export const Route = createFileRoute("/api/auth/gmail/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: search.code as string | undefined,
    error: search.error as string | undefined,
    state: search.state as string | undefined,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const result = await handleGmailCallback({
      data: {
        code: deps.search.code,
        error: deps.search.error,
        state: deps.search.state,
      },
    });

    throw redirect({ to: result.redirect });
  },
  component: () => {
    return <div>Redirecting...</div>;
  },
});
