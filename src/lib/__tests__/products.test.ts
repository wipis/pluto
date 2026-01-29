import { describe, it, expect } from "vitest";
import {
  getProduct,
  getProductList,
  isValidProductId,
  products,
  type ProductId,
} from "../products";

describe("products", () => {
  describe("getProduct", () => {
    it("returns file-logic product", () => {
      const product = getProduct("file-logic");
      expect(product.id).toBe("file-logic");
      expect(product.name).toBe("File Logic");
      expect(product.valueProps).toBeInstanceOf(Array);
      expect(product.valueProps.length).toBeGreaterThan(0);
    });

    it("returns consulting product", () => {
      const product = getProduct("consulting");
      expect(product.id).toBe("consulting");
      expect(product.name).toBe("Design Engineering Consulting");
    });

    it("returns offerarc product", () => {
      const product = getProduct("offerarc");
      expect(product.id).toBe("offerarc");
      expect(product.name).toBe("OfferArc");
    });
  });

  describe("getProductList", () => {
    it("returns all 3 products", () => {
      const list = getProductList();
      expect(list).toHaveLength(3);
    });

    it("returns products with required fields", () => {
      const list = getProductList();
      for (const product of list) {
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        expect(product.description).toBeDefined();
        expect(product.valueProps).toBeInstanceOf(Array);
        expect(product.targetAudience).toBeDefined();
        expect(product.enrichmentQuery).toBeInstanceOf(Function);
        expect(product.emailSystemPrompt).toBeDefined();
      }
    });
  });

  describe("isValidProductId", () => {
    it("returns true for valid product IDs", () => {
      expect(isValidProductId("file-logic")).toBe(true);
      expect(isValidProductId("consulting")).toBe(true);
      expect(isValidProductId("offerarc")).toBe(true);
    });

    it("returns false for invalid product IDs", () => {
      expect(isValidProductId("invalid")).toBe(false);
      expect(isValidProductId("")).toBe(false);
      expect(isValidProductId("FILE-LOGIC")).toBe(false);
    });
  });

  describe("enrichmentQuery", () => {
    it("generates query for file-logic", () => {
      const product = getProduct("file-logic");
      const query = product.enrichmentQuery("Acme Law");
      expect(query).toContain("Acme Law");
      expect(query).toContain("social security disability");
    });

    it("generates query for consulting", () => {
      const product = getProduct("consulting");
      const query = product.enrichmentQuery("TechCorp");
      expect(query).toContain("TechCorp");
      expect(query).toContain("startup");
    });

    it("generates query for offerarc", () => {
      const product = getProduct("offerarc");
      const query = product.enrichmentQuery("AdAgency");
      expect(query).toContain("AdAgency");
      expect(query).toContain("facebook ads");
    });
  });

  describe("emailSystemPrompt", () => {
    it("includes concise requirement for all products", () => {
      for (const product of Object.values(products)) {
        expect(product.emailSystemPrompt).toContain("Concise");
        expect(product.emailSystemPrompt).toContain("150 words");
      }
    });

    it("includes personalization requirement for all products", () => {
      for (const product of Object.values(products)) {
        expect(product.emailSystemPrompt).toContain("Personalized");
      }
    });
  });
});
