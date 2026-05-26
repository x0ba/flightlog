CREATE TYPE "public"."regression_case_run_status" AS ENUM('pending', 'running', 'success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."regression_run_status" AS ENUM('pending', 'running', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"installation_id" integer NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"owner_user_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "github_installations_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "regression_case_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"regression_run_id" integer NOT NULL,
	"case_id" integer NOT NULL,
	"run_id" integer,
	"evaluation_id" integer,
	"status" "regression_case_run_status" DEFAULT 'pending' NOT NULL,
	"score" integer,
	"passed" boolean,
	"failure_reason" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "regression_case_runs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "regression_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"suite_id" integer NOT NULL,
	"name" text NOT NULL,
	"goal" text NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_behavior" text,
	"agent_config" jsonb,
	"min_score" integer DEFAULT 70 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "regression_cases_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "regression_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"suite_id" integer NOT NULL,
	"owner_user_id" text,
	"status" "regression_run_status" DEFAULT 'pending' NOT NULL,
	"github_owner" text,
	"github_repo" text,
	"github_sha" text,
	"github_ref" text,
	"pull_request_number" integer,
	"github_check_run_id" bigint,
	"aggregate_score" integer,
	"passed" boolean,
	"summary" text,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "regression_runs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "regression_suites" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"github_installation_id" integer,
	"name" text NOT NULL,
	"description" text,
	"repository_owner" text NOT NULL,
	"repository_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"evaluation_policy" jsonb DEFAULT '{"minScore":70,"allowConstraintViolations":false,"allowErrorFindings":false}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "regression_suites_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "regression_case_runs" ADD CONSTRAINT "regression_case_runs_regression_run_id_regression_runs_id_fk" FOREIGN KEY ("regression_run_id") REFERENCES "public"."regression_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_case_runs" ADD CONSTRAINT "regression_case_runs_case_id_regression_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."regression_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_case_runs" ADD CONSTRAINT "regression_case_runs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_case_runs" ADD CONSTRAINT "regression_case_runs_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_cases" ADD CONSTRAINT "regression_cases_suite_id_regression_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."regression_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD CONSTRAINT "regression_runs_suite_id_regression_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."regression_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_suites" ADD CONSTRAINT "regression_suites_github_installation_id_github_installations_id_fk" FOREIGN KEY ("github_installation_id") REFERENCES "public"."github_installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_installation_id_idx" ON "github_installations" USING btree ("installation_id");