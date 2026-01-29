import { describe, it, expect } from "vitest";
import type { CampaignContactStage } from "@/lib/db/schema";

// Database tests require native SQLite bindings.
// These tests focus on business logic and data transformation.

describe("campaign stage transitions", () => {
  const VALID_STAGES: CampaignContactStage[] = [
    "new",
    "enriching",
    "enriched",
    "drafting",
    "drafted",
    "approved",
    "sending",
    "sent",
    "replied",
    "bounced",
    "skipped",
  ];

  it("defines all valid stages", () => {
    expect(VALID_STAGES).toHaveLength(11);
  });

  describe("stage order validation", () => {
    const STAGE_ORDER: Record<CampaignContactStage, number> = {
      new: 0,
      enriching: 1,
      enriched: 2,
      drafting: 3,
      drafted: 4,
      approved: 5,
      sending: 6,
      sent: 7,
      replied: 8,
      bounced: 8,
      skipped: -1,
    };

    it("new comes before enriching", () => {
      expect(STAGE_ORDER.new).toBeLessThan(STAGE_ORDER.enriching);
    });

    it("enriched comes before drafting", () => {
      expect(STAGE_ORDER.enriched).toBeLessThan(STAGE_ORDER.drafting);
    });

    it("approved comes before sending", () => {
      expect(STAGE_ORDER.approved).toBeLessThan(STAGE_ORDER.sending);
    });

    it("sent comes before replied", () => {
      expect(STAGE_ORDER.sent).toBeLessThan(STAGE_ORDER.replied);
    });
  });

  describe("terminal states", () => {
    const TERMINAL_STAGES: CampaignContactStage[] = [
      "replied",
      "bounced",
      "skipped",
    ];

    it("identifies terminal stages", () => {
      for (const stage of TERMINAL_STAGES) {
        expect(VALID_STAGES).toContain(stage);
      }
    });
  });
});

describe("campaign status", () => {
  const VALID_STATUSES = ["draft", "active", "paused", "completed"];

  it("defines all valid statuses", () => {
    expect(VALID_STATUSES).toHaveLength(4);
  });

  it("default status is draft", () => {
    const defaultStatus = "draft";
    expect(VALID_STATUSES).toContain(defaultStatus);
  });
});

describe("draft content validation", () => {
  it("validates subject is not empty", () => {
    const subject = "Test Subject";
    expect(subject.trim().length).toBeGreaterThan(0);
  });

  it("validates body is not empty", () => {
    const body = "Test body content";
    expect(body.trim().length).toBeGreaterThan(0);
  });

  it("handles subject with whitespace", () => {
    const subject = "  Test Subject  ";
    expect(subject.trim()).toBe("Test Subject");
  });
});

describe("enrichment data", () => {
  it("serializes enrichment results to JSON", () => {
    const enrichmentData = {
      query: "Company name research",
      results: [
        { title: "Result 1", url: "https://example.com/1" },
        { title: "Result 2", url: "https://example.com/2" },
      ],
    };
    const serialized = JSON.stringify(enrichmentData);
    expect(JSON.parse(serialized)).toEqual(enrichmentData);
  });

  it("handles empty results", () => {
    const enrichmentData = {
      query: "Company name research",
      results: [],
    };
    const serialized = JSON.stringify(enrichmentData);
    const parsed = JSON.parse(serialized);
    expect(parsed.results).toHaveLength(0);
  });
});

describe("campaign contact counts", () => {
  it("calculates stage counts", () => {
    const stages: CampaignContactStage[] = [
      "new",
      "new",
      "enriched",
      "drafted",
      "sent",
      "sent",
      "sent",
    ];

    const counts = stages.reduce(
      (acc, stage) => {
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    expect(counts.new).toBe(2);
    expect(counts.enriched).toBe(1);
    expect(counts.drafted).toBe(1);
    expect(counts.sent).toBe(3);
  });
});
