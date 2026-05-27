ALTER TYPE "public"."provider" ADD VALUE IF NOT EXISTS 'browserbase';--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD COLUMN IF NOT EXISTS "browserbase_project_id" text;--> statement-breakpoint
DELETE FROM "provider_credentials" WHERE "owner_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "provider_credentials" ALTER COLUMN "owner_user_id" SET NOT NULL;
