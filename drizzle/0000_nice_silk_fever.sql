CREATE TABLE `pilot_edits` (
	`process_number` text PRIMARY KEY NOT NULL,
	`review_status` text NOT NULL,
	`priority` text NOT NULL,
	`responsible` text,
	`working_execution_classification` text,
	`credit_consolidated` real,
	`amount_received` real,
	`available_cash` real,
	`guarantee_status` text,
	`next_action` text,
	`legal_notes` text,
	`internal_notes` text,
	`updated_at` text,
	`updated_by` text,
	`audit_trail` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`must_change_password` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`password_changed_at` text,
	`temporary_credential_created_at` text
);
