import { vi } from "vitest";

// Mock globalThis.env for server functions
(globalThis as any).env = {
  DB: null, // Will be set per-test
  ANTHROPIC_API_KEY: "test-key",
  EXA_API_KEY: "test-key",
  COMPOSIO_API_KEY: "test-key",
};

// Mock fetch for external API calls
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    })
  )
);
