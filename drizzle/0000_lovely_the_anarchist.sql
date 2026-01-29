CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`campaign_id` text,
	`type` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activities_contact_idx` ON `activities` (`contact_id`);--> statement-breakpoint
CREATE INDEX `activities_type_idx` ON `activities` (`type`);--> statement-breakpoint
CREATE TABLE `campaign_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`enrichment_data` text,
	`draft_subject` text,
	`draft_body` text,
	`final_subject` text,
	`final_body` text,
	`sent_at` integer,
	`opened_at` integer,
	`replied_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `campaign_contacts_campaign_idx` ON `campaign_contacts` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `campaign_contacts_contact_idx` ON `campaign_contacts` (`contact_id`);--> statement-breakpoint
CREATE INDEX `campaign_contacts_stage_idx` ON `campaign_contacts` (`stage`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`product` text NOT NULL,
	`description` text,
	`template_prompt` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`enrichment_data` text,
	`enriched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `companies_domain_idx` ON `companies` (`domain`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`first_name` text,
	`last_name` text,
	`email` text NOT NULL,
	`title` text,
	`linkedin_url` text,
	`phone` text,
	`notes` text,
	`tags` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_email_unique` ON `contacts` (`email`);--> statement-breakpoint
CREATE INDEX `contacts_email_idx` ON `contacts` (`email`);--> statement-breakpoint
CREATE INDEX `contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`campaign_id` text,
	`thread_id` text,
	`message_id` text,
	`direction` text NOT NULL,
	`subject` text,
	`body` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `emails_contact_idx` ON `emails` (`contact_id`);--> statement-breakpoint
CREATE INDEX `emails_thread_idx` ON `emails` (`thread_id`);