CREATE TABLE `gmail_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_type` text DEFAULT 'Bearer' NOT NULL,
	`expires_at` integer NOT NULL,
	`scope` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_tokens_user_email_unique` ON `gmail_tokens` (`user_email`);--> statement-breakpoint
CREATE INDEX `gmail_tokens_email_idx` ON `gmail_tokens` (`user_email`);