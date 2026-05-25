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
	'final_result'
]);
export const eventStatusEnum = pgEnum('event_status', ['pending', 'success', 'failed', 'skipped']);
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

export const events = pgTable(
	'events',
	{
		id: serial('id').primaryKey(),
		publicId: text('public_id').notNull().unique(),
		runId: integer('run_id')
			.notNull()
			.references(() => runs.id, { onDelete: 'cascade' }),
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
