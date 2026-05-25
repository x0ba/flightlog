CREATE TYPE "public"."provider" AS ENUM('openai', 'anthropic');--> statement-breakpoint
CREATE TYPE "public"."agent_framework" AS ENUM('native', 'ai-sdk', 'langchain', 'custom');--> statement-breakpoint
CREATE TYPE "public"."tool_policy" AS ENUM('curated_safe');--> statement-breakpoint
CREATE TYPE "public"."approval_policy" AS ENUM('risk_based', 'always', 'never');--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"provider" "provider" NOT NULL,
	"label" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"key_preview" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "provider_credentials_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "agent_run_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" "provider" NOT NULL,
	"framework" "agent_framework" DEFAULT 'native' NOT NULL,
	"model" text NOT NULL,
	"credential_id" integer NOT NULL,
	"tool_policy" "tool_policy" DEFAULT 'curated_safe' NOT NULL,
	"approval_policy" "approval_policy" DEFAULT 'risk_based' NOT NULL,
	"temperature" integer,
	"max_steps" integer DEFAULT 12 NOT NULL,
	"system_prompt" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "agent_run_configs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "agent_run_configs" ADD CONSTRAINT "agent_run_configs_credential_id_provider_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."provider_credentials"("id") ON DELETE cascade ON UPDATE no action;
