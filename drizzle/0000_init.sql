CREATE TABLE `api_usage` (
	`day` text NOT NULL,
	`provider` text NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `geocode_cache` (
	`query` text PRIMARY KEY NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`label` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`place_id` text NOT NULL,
	`source` text NOT NULL,
	`name` text NOT NULL,
	`type_label` text DEFAULT '' NOT NULL,
	`address` text,
	`phone` text,
	`website` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`score` integer NOT NULL,
	`snapshot` text NOT NULL,
	`snapshot_at` integer NOT NULL,
	`status` text DEFAULT 'a_contacter' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`follow_up_at` integer,
	`audit` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospects_user_place_idx` ON `prospects` (`user_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `prospects_user_status_idx` ON `prospects` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `search_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_cache_expires_idx` ON `search_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);