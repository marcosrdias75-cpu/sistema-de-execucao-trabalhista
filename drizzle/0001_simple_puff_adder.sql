CREATE TABLE `ai_analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`process_number` text NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`prompt_version` text NOT NULL,
	`model_route` text,
	`requested_by` text NOT NULL,
	`requested_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sent_at` text,
	`completed_at` text,
	`analysis_prompt` text NOT NULL,
	`result_text` text,
	`result_payload` text,
	`failure_message` text
);
