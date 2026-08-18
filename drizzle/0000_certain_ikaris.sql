CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`whatsapp` text NOT NULL,
	`service_id` text NOT NULL,
	`service_name` text NOT NULL,
	`service_duration` integer NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`total_cents` integer NOT NULL,
	`payment_type` text NOT NULL,
	`payment_amount_cents` integer NOT NULL,
	`payment_status` text DEFAULT 'pendente' NOT NULL,
	`status` text DEFAULT 'confirmado' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_request_id` ON `appointments` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_active_slot` ON `appointments` (`date`,`time`) WHERE "appointments"."status" != 'cancelado';--> statement-breakpoint
CREATE INDEX `idx_appointments_date_status` ON `appointments` (`date`,`status`);--> statement-breakpoint
CREATE TABLE `blocked_times` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT 'Bloqueado pela equipe' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blocked_date_time` ON `blocked_times` (`date`,`time`);--> statement-breakpoint
CREATE INDEX `idx_blocked_date` ON `blocked_times` (`date`);--> statement-breakpoint
CREATE TABLE `schedule_claims` (
	`claim_date` text NOT NULL,
	`slot_minute` integer NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	PRIMARY KEY(`claim_date`, `slot_minute`)
);
--> statement-breakpoint
CREATE INDEX `idx_schedule_claims_owner` ON `schedule_claims` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`duration` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_services_active_sort` ON `services` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
