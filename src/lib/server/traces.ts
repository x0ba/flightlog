import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { runs, spans, type spanStatusEnum } from '$lib/server/db/schema';
import { appendEvent } from '$lib/server/events';
import { publicId } from '$lib/server/public-id';
import { createRun, updateRun } from '$lib/server/runs';
import type { createSpanSchema, createTraceSchema, updateSpanSchema } from '$lib/server/validation';
import type { z } from 'zod';

type SpanStatus = (typeof spanStatusEnum.enumValues)[number];
type RunRow = typeof runs.$inferSelect;
type CreateTraceInput = z.infer<typeof createTraceSchema>;
type CreateSpanInput = z.infer<typeof createSpanSchema>;
type UpdateSpanInput = z.infer<typeof updateSpanSchema>;

export async function createTrace(ownerUserId: string, input: CreateTraceInput) {
	const trace = await createRun({
		...input,
		ownerUserId,
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
	trace: RunRow,
	input: { status: 'success' | 'failed' | 'cancelled'; metadata?: unknown }
) {
	const updated = await updateRun(trace.publicId, input);
	if (!updated) return undefined;
	await appendEvent(updated.id, {
		type: input.status === 'success' ? 'trace.completed' : 'trace.failed',
		status: input.status === 'success' ? 'success' : 'failed',
		data: { status: input.status }
	});
	return updated;
}

export async function createSpanForRun(trace: RunRow, input: CreateSpanInput) {
	const parentSpan = input.parentSpanId
		? await findSpanByPublicId(input.parentSpanId, trace.id)
		: undefined;
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

export async function updateSpanForRun(
	trace: RunRow,
	publicSpanId: string,
	input: UpdateSpanInput
) {
	const existing = await findSpanByPublicId(publicSpanId, trace.id);
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

async function findSpanByPublicId(publicSpanId: string, runId: number) {
	const [span] = await db
		.select()
		.from(spans)
		.where(and(eq(spans.publicId, publicSpanId), eq(spans.runId, runId)))
		.limit(1);
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
