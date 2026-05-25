import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spans, type spanStatusEnum } from '$lib/server/db/schema';
import { appendEvent } from '$lib/server/events';
import { publicId } from '$lib/server/public-id';
import { createRun, findRun, updateRun } from '$lib/server/runs';
import type { createSpanSchema, createTraceSchema, updateSpanSchema } from '$lib/server/validation';
import type { z } from 'zod';

type SpanStatus = (typeof spanStatusEnum.enumValues)[number];
type CreateTraceInput = z.infer<typeof createTraceSchema>;
type CreateSpanInput = z.infer<typeof createSpanSchema>;
type UpdateSpanInput = z.infer<typeof updateSpanSchema>;

export async function createTrace(input: CreateTraceInput) {
	const trace = await createRun({
		...input,
		schemaVersion: input.schemaVersion
	});
	await appendEvent(trace.id, {
		type: 'goal.set',
		message: trace.goal,
		status: 'success',
		data: {
			schemaVersion: input.schemaVersion,
			name: trace.name,
			agent: {
				name: trace.agentName,
				version: trace.agentVersion
			}
		}
	});
	return trace;
}

export async function finishTrace(
	publicTraceId: string,
	input: { status: 'success' | 'failed' | 'cancelled'; metadata?: unknown }
) {
	const trace = await updateRun(publicTraceId, input);
	if (!trace) return undefined;
	await appendEvent(trace.id, {
		type: input.status === 'success' ? 'trace.completed' : 'trace.failed',
		status: input.status === 'success' ? 'success' : 'failed',
		data: { status: input.status }
	});
	return trace;
}

export async function createSpan(publicTraceId: string, input: CreateSpanInput) {
	const trace = await findRun(publicTraceId);
	if (!trace) return undefined;
	const parentSpan = input.parentSpanId ? await findSpanByPublicId(input.parentSpanId) : undefined;
	const [span] = await db
		.insert(spans)
		.values({
			publicId: publicId('spn'),
			runId: trace.id,
			parentSpanId: parentSpan?.id,
			kind: input.kind,
			name: input.name,
			status: input.status,
			input: input.input,
			attributes: input.attributes,
			startedAt: input.startedAt ? new Date(input.startedAt) : new Date()
		})
		.returning();

	await appendEvent(trace.id, {
		spanId: span.publicId,
		type: eventTypeForSpan(span.kind, input.status),
		title: span.name,
		status: eventStatusForSpan(input.status),
		data: {
			input: input.input,
			attributes: input.attributes,
			parentSpanId: input.parentSpanId ?? null
		}
	});

	return span;
}

export async function updateSpan(
	publicTraceId: string,
	publicSpanId: string,
	input: UpdateSpanInput
) {
	const trace = await findRun(publicTraceId);
	if (!trace) return undefined;
	const existing = await findSpanByPublicId(publicSpanId);
	if (!existing || existing.runId !== trace.id) return undefined;
	const [span] = await db
		.update(spans)
		.set({
			status: input.status,
			output: input.output,
			error: input.error,
			attributes: input.attributes ?? existing.attributes,
			endedAt: input.endedAt ? new Date(input.endedAt) : new Date(),
			updatedAt: new Date()
		})
		.where(eq(spans.id, existing.id))
		.returning();

	await appendEvent(trace.id, {
		spanId: span.publicId,
		type: eventTypeForSpan(span.kind, input.status),
		title: span.name,
		status: eventStatusForSpan(input.status),
		data: {
			output: input.output,
			error: input.error,
			attributes: input.attributes
		}
	});

	return span;
}

export async function listSpans(runId: number) {
	return db.select().from(spans).where(eq(spans.runId, runId));
}

async function findSpanByPublicId(publicSpanId: string) {
	const [span] = await db.select().from(spans).where(eq(spans.publicId, publicSpanId)).limit(1);
	return span;
}

function eventTypeForSpan(kind: string, status: SpanStatus) {
	const phase =
		status === 'completed'
			? 'completed'
			: status === 'failed' || status === 'cancelled'
				? 'failed'
				: status === 'running'
					? 'started'
					: 'requested';
	if (kind === 'model_call') return `model_call.${phase}` as const;
	if (kind === 'tool_call') return `tool_call.${phase}` as const;
	if (kind === 'browser_action') return `browser_action.${phase}` as const;
	if (kind === 'approval')
		return phase === 'completed' ? 'approval.resolved' : 'approval.requested';
	if (kind === 'evaluation')
		return phase === 'completed' ? 'evaluation.completed' : 'evaluation.created';
	return phase === 'completed' ? 'trace.completed' : 'plan.created';
}

function eventStatusForSpan(status: SpanStatus) {
	if (status === 'completed') return 'success';
	if (status === 'failed' || status === 'cancelled') return 'failed';
	if (status === 'pending') return 'pending';
	return undefined;
}
