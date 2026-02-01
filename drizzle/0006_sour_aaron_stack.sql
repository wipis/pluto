DROP INDEX `gmail_tokens_user_email_unique`;--> statement-breakpoint
ALTER TABLE `gmail_tokens` ADD `label` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `gmail_account_id` text;