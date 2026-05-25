import { pgTable, pgEnum, serial, integer, text, timestamp, json } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm/sql/sql';

export const statusEnum = pgEnum('status', ['running', 'success', 'failed', 'cancelled']);
export const eventTypeEnum = pgEnum('type', [
	'thought', 
	'plan', 
	'tool_call', 
	'tool_result', 
	'browser_action', 
	'observation', 
	'error', 
	'human_approval', 
	'final_result'
]);
export const artifactTypeEnum = pgEnum('artifact_type', [
	'screenshot', 
	'html', 
	'text', 
	'json'
]);

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const run = pgTable('run', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	goal: text('goal').notNull(),
	status: statusEnum('status').notNull().default('running'),
	startedAt: timestamp('started_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	endedAt: timestamp('ended_at'),
	metadata: json('metadata')
});

export const event = pgTable('event', {
	id: serial('id').primaryKey(),
	runId: serial('run_id').notNull().references(() => run.id),
	type: eventTypeEnum('type').notNull(),
	timestamp: timestamp('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
	message: text('message'),
	data: json('data')
});

export const artifact = pgTable('artifact', {
	id: serial('id').primaryKey(),
	runId: serial('run_id').notNull().references(() => run.id),
	eventId: serial('event_id').references(() => event.id),
	type: artifactTypeEnum('type').notNull(),
	url: text('url'),
	content: text('content'),
	createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});