// Custom worker entry point that adds queue handling to TanStack Start
import type { MessageBatch, ExportedHandler } from "@cloudflare/workers-types";
import type { JobMessage, JobResult } from "@/lib/queue/types";
import {
  processEnrichment,
  processDrafting,
  processSending,
  processReplyCheck,
} from "@/lib/queue/processors";
import { validateEnv } from "@/lib/env-validation";

// Import the TanStack Start handler
import tanstackHandler from "@tanstack/react-start/server-entry";

// Combined handler with both HTTP fetch and queue consumer
const handler: ExportedHandler<Cloudflare.Env, JobMessage> = {
  // HTTP request handler from TanStack Start
  fetch: async (request, env, ctx) => {
    validateEnv(env);
    return tanstackHandler.fetch(request, env, ctx);
  },

  // Queue consumer handler
  async queue(batch: MessageBatch<JobMessage>, env: Cloudflare.Env): Promise<void> {
    validateEnv(env);
    for (const message of batch.messages) {
      const job = message.body;

      try {
        let result: JobResult;

        switch (job.type) {
          case "enrich":
            result = await processEnrichment(job, env);
            break;
          case "draft":
            result = await processDrafting(job, env);
            break;
          case "send":
            result = await processSending(job, env);
            break;
          case "check_replies":
            result = await processReplyCheck(env);
            break;
          default:
            console.error("Unknown job type:", job);
            message.ack();
            continue;
        }

        if (result.success) {
          message.ack();
        } else if (result.retryable) {
          console.error(`Job failed (will retry): ${result.error}`);
          message.retry();
        } else {
          console.error(`Job failed (no retry): ${result.error}`);
          message.ack(); // Don't retry non-retryable errors
        }
      } catch (error) {
        console.error("Job processing error:", error);
        message.retry();
      }
    }
  },
};

export default handler;
