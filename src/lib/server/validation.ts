import { z } from 'zod';

export const runStatusSchema = z.enum(['running', 'success', 'failed', 'cancelled']);
export const eventTypeSchema = z.enum([
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
export const eventStatusSchema = z.enum(['pending', 'success', 'failed', 'skipped']);
export const artifactTypeSchema = z.enum([
	'screenshot',
	'dom_snapshot',
	'html',
	'text',
	'json',
	'log'
]);

const jsonValue = z.unknown();

export const createRunSchema = z.object({
	name: z.string().min(1).optional(),
	goal: z.string().min(1),
	agentName: z.string().min(1).optional(),
	agentVersion: z.string().min(1).optional(),
	environment: z.string().min(1).optional(),
	metadata: jsonValue.optional()
});

export const updateRunSchema = z.object({
	status: runStatusSchema,
	metadata: jsonValue.optional()
});

export const appendEventSchema = z.object({
	type: eventTypeSchema,
	title: z.string().min(1).optional(),
	message: z.string().optional(),
	data: jsonValue.optional(),
	status: eventStatusSchema.optional(),
	occurredAt: z.string().datetime().optional()
});

export const batchEventsSchema = z.object({
	events: z.array(appendEventSchema).min(1)
});

export const createArtifactSchema = z.object({
	eventId: z.string().min(1).optional().nullable(),
	type: artifactTypeSchema,
	name: z.string().min(1).optional(),
	mimeType: z.string().min(1).optional(),
	url: z.string().min(1).optional().nullable(),
	content: z.string().optional().nullable(),
	metadata: jsonValue.optional()
});

export const evaluateRunSchema = z.object({
	constraints: z.array(z.string().min(1)).optional().default([])
});

export const createAgentRunSchema = z.object({
	prompt: z.string().min(1),
	name: z.string().min(1).optional(),
	constraints: z.array(z.string().min(1)).optional().default([])
});

export const approvalDecisionSchema = z.object({
	approvalId: z.string().min(1),
	decision: z.enum(['approved', 'rejected']),
	note: z.string().optional()
});
