ALTER TABLE "runs" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "agent_run_configs" ADD COLUMN "owner_user_id" text;
