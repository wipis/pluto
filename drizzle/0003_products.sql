CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`value_props` text NOT NULL,
	`target_audience` text NOT NULL,
	`enrichment_query_template` text NOT NULL,
	`email_system_prompt` text NOT NULL,
	`is_default` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
