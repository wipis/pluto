import { describe, it, expect } from "vitest";
import { validateEnv, EnvValidationError } from "./env-validation";

describe("validateEnv", () => {
  it("passes with all required keys", () => {
    const env = {
      DB: {},
      JOBS_QUEUE: {},
      GMAIL_CLIENT_ID: "id",
      GMAIL_CLIENT_SECRET: "secret",
      ANTHROPIC_API_KEY: "key",
      EXA_API_KEY: "key",
      BETTER_AUTH_SECRET: "secret",
    } as unknown as Cloudflare.Env;

    expect(() => validateEnv(env)).not.toThrow();
  });

  it("throws for empty env", () => {
    const env = {} as unknown as Cloudflare.Env;

    expect(() => validateEnv(env)).toThrow(EnvValidationError);
  });

  it("reports all missing keys", () => {
    const env = {
      DB: {},
      GMAIL_CLIENT_ID: "id",
    } as unknown as Cloudflare.Env;

    try {
      validateEnv(env);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const envError = error as EnvValidationError;
      expect(envError.missingKeys).toContain("JOBS_QUEUE");
      expect(envError.missingKeys).toContain("GMAIL_CLIENT_SECRET");
      expect(envError.missingKeys).toContain("ANTHROPIC_API_KEY");
      expect(envError.missingKeys).toContain("EXA_API_KEY");
      expect(envError.missingKeys).toContain("BETTER_AUTH_SECRET");
      expect(envError.missingKeys).not.toContain("DB");
      expect(envError.missingKeys).not.toContain("GMAIL_CLIENT_ID");
    }
  });

  it("error message includes missing key names", () => {
    const env = {} as unknown as Cloudflare.Env;

    try {
      validateEnv(env);
    } catch (error) {
      expect((error as Error).message).toContain("ANTHROPIC_API_KEY");
      expect((error as Error).message).toContain("Missing required environment variables");
    }
  });
});
