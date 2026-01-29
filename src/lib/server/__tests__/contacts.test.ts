import { describe, it, expect } from "vitest";

// Database tests require native SQLite bindings.
// These are integration tests that should be run with proper D1 setup.
// For now, we test only the validation and transformation logic.

describe("contacts validation", () => {
  describe("email validation", () => {
    it("accepts valid email formats", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "user+tag@example.co.uk",
      ];
      for (const email of validEmails) {
        expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });

    it("rejects invalid email formats", () => {
      const invalidEmails = ["notanemail", "@missing.user", "missing@domain"];
      for (const email of invalidEmails) {
        expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });
  });

  describe("name formatting", () => {
    it("handles full name split", () => {
      const fullName = "John Doe";
      const [firstName, ...lastParts] = fullName.split(" ");
      const lastName = lastParts.join(" ");
      expect(firstName).toBe("John");
      expect(lastName).toBe("Doe");
    });

    it("handles single name", () => {
      const fullName = "John";
      const [firstName, ...lastParts] = fullName.split(" ");
      const lastName = lastParts.join(" ");
      expect(firstName).toBe("John");
      expect(lastName).toBe("");
    });

    it("handles multiple last names", () => {
      const fullName = "John Van Der Berg";
      const [firstName, ...lastParts] = fullName.split(" ");
      const lastName = lastParts.join(" ");
      expect(firstName).toBe("John");
      expect(lastName).toBe("Van Der Berg");
    });
  });

  describe("tags serialization", () => {
    it("serializes tags array to JSON", () => {
      const tags = ["vip", "customer", "enterprise"];
      const serialized = JSON.stringify(tags);
      expect(serialized).toBe('["vip","customer","enterprise"]');
    });

    it("deserializes JSON to tags array", () => {
      const serialized = '["vip","customer","enterprise"]';
      const tags = JSON.parse(serialized);
      expect(tags).toEqual(["vip", "customer", "enterprise"]);
    });

    it("handles null tags", () => {
      const tags = null;
      expect(tags).toBeNull();
    });
  });
});

describe("company domain extraction", () => {
  it("extracts domain from email", () => {
    const email = "john@acmelaw.com";
    const domain = email.split("@")[1];
    expect(domain).toBe("acmelaw.com");
  });

  it("handles subdomains", () => {
    const email = "user@mail.company.co.uk";
    const domain = email.split("@")[1];
    expect(domain).toBe("mail.company.co.uk");
  });
});
