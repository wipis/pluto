ALTER TABLE `campaign_contacts` ADD `regeneration_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_contacts` ADD `last_feedback` text;--> statement-breakpoint
ALTER TABLE `campaign_contacts` ADD `hook_used` text;--> statement-breakpoint
ALTER TABLE `campaign_contacts` ADD `enrichment_score` integer;