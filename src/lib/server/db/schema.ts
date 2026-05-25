import {
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const runStatusEnum = pgEnum('run_status', ['running', 'success', 'failed', 'cancelled']);
export const providerEnum = pgEnum('provider', ['openai', 'anthropic']);
export const agentFrameworkEnum = pgEnum('agent_framework', [
	'native',
	'ai-sdk',
	'langchain',
	'custom'
]);
export const toolPolicyEnum = pgEnum('tool_policy', ['curated_safe']);
export const approvalPolicyEnum = pgEnum('approval_policy', ['risk_based', 'always', 'never']);
export const eventTypeEnum = pgEnum('event_type', [
	'goal',
	'plan',
	'planned_action',
	'tool_call',
	'tool_result',
	'browser_action',
	'observation',
	'reasoning_summary',
	'human_approval',
	'constraint',
	'error',
	'final_result',
	'goal.set',
	'plan.created',
	'model_call.requested',
	'model_call.started',
	'model_call.completed',
	'model_call.failed',
	'tool_call.requested',
	'tool_call.started',
	'tool_call.completed',
	'tool_call.failed',
	'browser_action.requested',
	'browser_action.started',
	'browser_action.completed',
	'browser_action.failed',
	'observation.created',
	'reasoning_summary.created',
	'approval.requested',
	'approval.resolved',
	'constraint.checked',
	'artifact.attached',
	'evaluation.created',
	'evaluation.completed',
	'trace.completed',
	'trace.failed'
]);
export const eventStatusEnum = pgEnum('event_status', ['pending', 'success', 'failed', 'skipped']);
export const spanKindEnum = pgEnum('span_kind', [
	'agent',
	'model_call',
	'tool_call',
	'browser_action',
	'approval',
	'evaluation',
	'custom'
]);
export const spanStatusEnum = pgEnum('span_status', [
	'pending',
	'running',
	'completed',
	'failed',
	'cancelled'
]);
export const artifactTypeEnum = pgEnum('artifact_type', [
	'screenshot',
	'dom_snapshot',
	'html',
	'text',
	'json',
	'log'
]);
export const evaluationStatusEnum = pgEnum('evaluation_status', [
	'pending',
	'running',
	'completed',
	'failed'
]);
export const findingSeverityEnum = pgEnum('finding_severity', ['info', 'warning', 'error']);
export const findingCategoryEnum = pgEnum('finding_category', [
	'goal_completion',
	'constraint_violation',
	'repetition',
	'human_approval',
	'tool_failure',
	'other'
]);

export const runs = pgTable('runs', {
	id: serial('id').primaryKey(),
	publicId: text('public_id').notNull().unique(),
	schemaVersion: text('schema_version').notNull().default('flightlog.run.v0'),
	name: text('name'),
	goal: text('goal').notNull(),
	status: runStatusEnum('status').notNull().default('running'),
	agentName: text('agent_name'),
	agentVersion: text('agent_version'),
	environment: text('environment'),
	metadata: jsonb('metadata'),
	startedAt: timestamp('started_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	endedAt: timestamp('ended_at'),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const providerCredentials = pgTable('provider_credentials', {
	id: serial('id').primaryKey(),
	publicId: text('public_id').notNull().unique(),
	provider: providerEnum('provider').notNull(),
	label: text('label').notNull(),
	encryptedApiKey: text('encrypted_api_key').notNull(),
	keyPreview: text('key_preview').notNull(),
	isEnabled: boolean('is_enabled').notNull().default(true),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const agentRunConfigs = pgTable('agent_run_configs', {
	id: serial('id').primaryKey(),
	publicId: text('public_id').notNull().unique(),
	name: text('name').notNull(),
	provider: providerEnum('provider').notNull(),
	framework: agentFrameworkEnum('framework').notNull().default('native'),
	model: text('model').notNull(),
	credentialId: integer('credential_id')
		.notNull()
		.references(() => providerCredentials.id, { onDelete: 'cascade' }),
	toolPolicy: toolPolicyEnum('tool_policy').notNull().default('curated_safe'),
	approvalPolicy: approvalPolicyEnum('approval_policy').notNull().default('risk_based'),
	temperature: integer('temperature'),
	maxSteps: integer('max_steps').notNull().default(12),
	systemPrompt: text('system_prompt'),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const spans = pgTable('spans', {
	id: serial('id').primaryKey(),
	publicId: text('public_id').notNull().unique(),
	runId: integer('run_id')
		.notNull()
		.references(() => runs.id, { onDelete: 'cascade' }),
	parentSpanId: integer('parent_span_id'),
	kind: spanKindEnum('kind').notNull(),
	name: text('name').notNull(),
	status: spanStatusEnum('status').notNull().default('pending'),
	input: jsonb('input'),
	output: jsonb('output'),
	error: jsonb('error'),
	attributes: jsonb('attributes'),
	startedAt: timestamp('started_at'),
	endedAt: timestamp('ended_at'),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const events = pgTable(
	'events',
	{
		id: serial('id').primaryKey(),
		publicId: text('public_id').notNull().unique(),
		runId: integer('run_id')
			.notNull()
			.references(() => runs.id, { onDelete: 'cascade' }),
		spanId: integer('span_id').references(() => spans.id, { onDelete: 'set null' }),
		sequence: integer('sequence').notNull(),
		type: eventTypeEnum('type').notNull(),
		title: text('title'),
		message: text('message'),
		data: jsonb('data'),
		status: eventStatusEnum('status'),
		occurredAt: timestamp('occurred_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		createdAt: timestamp('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [uniqueIndex('events_run_sequence_idx').on(table.runId, table.sequence)]
);

export const artifacts = pgTable('artifacts', {
	id: serial('id').primaryKey(),
	publicId: text('public_id').notNull().unique(),
	runId: integer('run_id')
		.notNull()
		.references(() => runs.id, { onDelete: 'cascade' }),
	eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }),
	type: artifactTypeEnum('type').notNull(),
	name: text('name'),
	mimeType: text('mime_type'),
	url: text('url'),
	content: text('content'),
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const evaluations = pgTable('evaluations', {
	id: serial('id').primaryKey(),
	publicId: text('public_id').notNull().unique(),
	runId: integer('run_id')
		.notNull()
		.references(() => runs.id, { onDelete: 'cascade' }),
	status: evaluationStatusEnum('status').notNull().default('pending'),
	goalCompleted: boolean('goal_completed'),
	violatedConstraints: boolean('violated_constraints'),
	repeatedActions: boolean('repeated_actions'),
	neededHumanApproval: boolean('needed_human_approval'),
	score: integer('score'),
	summary: text('summary'),
	explanation: text('explanation'),
	data: jsonb('data'),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	completedAt: timestamp('completed_at')
});

export const evaluationFindings = pgTable('evaluation_findings', {
	id: serial('id').primaryKey(),
	evaluationId: integer('evaluation_id')
		.notNull()
		.references(() => evaluations.id, { onDelete: 'cascade' }),
	runId: integer('run_id')
		.notNull()
		.references(() => runs.id, { onDelete: 'cascade' }),
	severity: findingSeverityEnum('severity').notNull(),
	category: findingCategoryEnum('category').notNull(),
	message: text('message').notNull(),
	eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }),
	data: jsonb('data'),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
