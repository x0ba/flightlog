CREATE TYPE "public"."artifact_type" AS ENUM('screenshot', 'dom_snapshot', 'html', 'text', 'json', 'log');--> statement-breakpoint
CREATE TYPE "public"."evaluation_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('pending', 'success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('goal', 'plan', 'planned_action', 'tool_call', 'tool_result', 'browser_action', 'observation', 'reasoning_summary', 'human_approval', 'constraint', 'error', 'final_result', 'goal.set', 'plan.created', 'model_call.requested', 'model_call.started', 'model_call.completed', 'model_call.failed', 'tool_call.requested', 'tool_call.started', 'tool_call.completed', 'tool_call.failed', 'browser_action.requested', 'browser_action.started', 'browser_action.completed', 'browser_action.failed', 'observation.created', 'reasoning_summary.created', 'approval.requested', 'approval.resolved', 'constraint.checked', 'artifact.attached', 'evaluation.created', 'evaluation.completed', 'trace.completed', 'trace.failed');--> statement-breakpoint
CREATE TYPE "public"."finding_category" AS ENUM('goal_completion', 'constraint_violation', 'repetition', 'human_approval', 'tool_failure', 'other');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."span_kind" AS ENUM('agent', 'model_call', 'tool_call', 'browser_action', 'approval', 'evaluation', 'custom');--> statement-breakpoint
CREATE TYPE "public"."span_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"run_id" integer NOT NULL,
	"event_id" integer,
	"type" "artifact_type" NOT NULL,
	"name" text,
	"mime_type" text,
	"url" text,
	"content" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "artifacts_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "evaluation_findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"evaluation_id" integer NOT NULL,
	"run_id" integer NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"category" "finding_category" NOT NULL,
	"message" text NOT NULL,
	"event_id" integer,
	"data" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"run_id" integer NOT NULL,
	"status" "evaluation_status" DEFAULT 'pending' NOT NULL,
	"goal_completed" boolean,
	"violated_constraints" boolean,
	"repeated_actions" boolean,
	"needed_human_approval" boolean,
	"score" integer,
	"summary" text,
	"explanation" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "evaluations_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"run_id" integer NOT NULL,
	"span_id" integer,
	"sequence" integer NOT NULL,
	"type" "event_type" NOT NULL,
	"title" text,
	"message" text,
	"data" jsonb,
	"status" "event_status",
	"occurred_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "events_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"schema_version" text DEFAULT 'flightlog.run.v0' NOT NULL,
	"name" text,
	"goal" text NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"agent_name" text,
	"agent_version" text,
	"environment" text,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "runs_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "spans" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"run_id" integer NOT NULL,
	"parent_span_id" integer,
	"kind" "span_kind" NOT NULL,
	"name" text NOT NULL,
	"status" "span_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" jsonb,
	"attributes" jsonb,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "spans_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_findings" ADD CONSTRAINT "evaluation_findings_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_findings" ADD CONSTRAINT "evaluation_findings_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_findings" ADD CONSTRAINT "evaluation_findings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_span_id_spans_id_fk" FOREIGN KEY ("span_id") REFERENCES "public"."spans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spans" ADD CONSTRAINT "spans_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_run_sequence_idx" ON "events" USING btree ("run_id","sequence");