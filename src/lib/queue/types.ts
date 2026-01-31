// Job message types for Cloudflare Queue
export type JobMessage =
  | { type: "enrich"; campaignContactId: string; campaignId: string }
  | { type: "draft"; campaignContactId: string; campaignId: string }
  | { type: "send"; campaignContactId: string }
  | { type: "check_replies" };

export interface JobResult {
  success: boolean;
  error?: string;
  retryable?: boolean;
}

// Stage mapping for queue operations
export const QUEUE_STAGES = {
  enrich: {
    queued: "queued_enrich",
    processing: "enriching",
    completed: "enriched",
    fallback: "new",
  },
  draft: {
    queued: "queued_draft",
    processing: "drafting",
    completed: "drafted",
    fallback: "enriched",
  },
  send: {
    queued: "queued_send",
    processing: "sending",
    completed: "sent",
    fallback: "approved",
  },
} as const;
