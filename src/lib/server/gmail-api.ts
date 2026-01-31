const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  body: string;
  accessToken: string;
}

interface GmailSendResponse {
  id: string;
  threadId: string;
  labelIds: string[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload?: {
    headers: Array<{ name: string; value: string }>;
  };
  internalDate: string;
}

interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

/**
 * Create a base64url encoded MIME message
 */
function createMimeMessage({
  to,
  from,
  subject,
  body,
}: Omit<SendEmailParams, "accessToken">): string {
  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\r\n");

  // Base64url encode (Gmail requires this format)
  const base64 = btoa(unescape(encodeURIComponent(email)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Send an email via Gmail API
 */
export async function sendGmailEmail({
  to,
  from,
  subject,
  body,
  accessToken,
}: SendEmailParams): Promise<GmailSendResponse> {
  const raw = createMimeMessage({ to, from, subject, body });

  const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail send failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get a specific message by ID
 */
export async function getMessage(
  messageId: string,
  accessToken: string
): Promise<GmailMessage> {
  const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail get message failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get all messages in a thread
 */
export async function getThread(
  threadId: string,
  accessToken: string
): Promise<GmailThread> {
  const response = await fetch(`${GMAIL_API_BASE}/threads/${threadId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail get thread failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * List messages matching a query
 */
export async function listMessages(
  query: string,
  accessToken: string,
  maxResults = 10
): Promise<{ messages: Array<{ id: string; threadId: string }> }> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });

  const response = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail list messages failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get the user's email address from their profile
 */
export async function getGmailProfile(
  accessToken: string
): Promise<{ emailAddress: string }> {
  const response = await fetch(`${GMAIL_API_BASE}/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail get profile failed: ${response.status} - ${error}`);
  }

  return response.json();
}
