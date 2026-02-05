import { describe, it, expect } from "vitest";
import {
  idSchema,
  emailSchema,
  createContactInput,
  importContactsInput,
  getCampaignsInput,
  paginationSchema,
} from "./validation";

describe("idSchema", () => {
  it("accepts valid IDs", () => {
    expect(idSchema.parse("abc123")).toBe("abc123");
    expect(idSchema.parse("a")).toBe("a");
  });

  it("rejects empty strings", () => {
    expect(() => idSchema.parse("")).toThrow();
  });

  it("rejects strings over 30 chars", () => {
    expect(() => idSchema.parse("a".repeat(31))).toThrow();
  });
});

describe("emailSchema", () => {
  it("accepts valid emails", () => {
    expect(emailSchema.parse("test@example.com")).toBe("test@example.com");
  });

  it("lowercases and trims", () => {
    expect(emailSchema.parse("  Test@Example.COM  ")).toBe("test@example.com");
  });

  it("rejects invalid emails", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow();
    expect(() => emailSchema.parse("")).toThrow();
  });
});

describe("createContactInput", () => {
  it("accepts complete input", () => {
    const result = createContactInput.parse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });
    expect(result.firstName).toBe("John");
    expect(result.email).toBe("john@example.com");
  });

  it("rejects missing email", () => {
    expect(() =>
      createContactInput.parse({
        firstName: "John",
        lastName: "Doe",
      })
    ).toThrow();
  });

  it("accepts optional fields", () => {
    const result = createContactInput.parse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      title: "CEO",
      tags: ["tag1", "tag2"],
    });
    expect(result.title).toBe("CEO");
    expect(result.tags).toEqual(["tag1", "tag2"]);
  });
});

describe("importContactsInput", () => {
  it("rejects empty rows", () => {
    expect(() =>
      importContactsInput.parse({ rows: [] })
    ).toThrow();
  });

  it("accepts valid import data", () => {
    const result = importContactsInput.parse({
      rows: [{ email: "test@example.com" }],
    });
    expect(result.rows).toHaveLength(1);
  });

  it("accepts optional campaignId", () => {
    const result = importContactsInput.parse({
      rows: [{ email: "test@example.com" }],
      campaignId: "camp1",
    });
    expect(result.campaignId).toBe("camp1");
  });
});

describe("getCampaignsInput", () => {
  it("defaults to empty object when undefined", () => {
    const result = getCampaignsInput.parse(undefined);
    expect(result).toEqual({});
  });

  it("accepts status filter", () => {
    const result = getCampaignsInput.parse({ status: "active" });
    expect(result.status).toBe("active");
  });
});

describe("paginationSchema", () => {
  it("accepts valid limits", () => {
    const result = paginationSchema.parse({ limit: 50, offset: 0 });
    expect(result.limit).toBe(50);
  });

  it("rejects limit over 200", () => {
    expect(() => paginationSchema.parse({ limit: 201 })).toThrow();
  });

  it("rejects negative offset", () => {
    expect(() => paginationSchema.parse({ offset: -1 })).toThrow();
  });

  it("accepts empty object", () => {
    const result = paginationSchema.parse({});
    expect(result.limit).toBeUndefined();
    expect(result.offset).toBeUndefined();
  });
});
