export class EnvValidationError extends Error {
  constructor(public missingKeys: string[]) {
    super(
      `Missing required environment variables: ${missingKeys.join(", ")}`
    );
    this.name = "EnvValidationError";
  }
}

const REQUIRED_KEYS = [
  "DB",
  "JOBS_QUEUE",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "ANTHROPIC_API_KEY",
  "EXA_API_KEY",
  "BETTER_AUTH_SECRET",
] as const;

export function validateEnv(env: Cloudflare.Env): void {
  const missing: string[] = [];

  for (const key of REQUIRED_KEYS) {
    if (!(env as Record<string, unknown>)[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new EnvValidationError(missing);
  }
}
