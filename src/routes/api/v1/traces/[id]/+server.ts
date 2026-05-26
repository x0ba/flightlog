import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artifacts, evaluationFindings, evaluations } from '$lib/server/db/schema';
import { listEvents } from '$lib/server/events';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRunForUser } from '$lib/server/runs';
import { finishTrace, listSpans } from '$lib/server/traces';
import { updateTraceSchema } from '$lib/server/validation';

export async function GET(event) {
	const userId = requireUserId(event);
	const trace = await findRunForUser(event.params.id, userId);
	if (!trace) notFound('Trace not found');
	const events = await listEvents(trace.id);
	const spans = await listSpans(trace.id);
	const artifactRows = await db.select().from(artifacts).where(eq(artifacts.runId, trace.id));
	const [evaluation] = await db
		.select()
		.from(evaluations)
		.where(eq(evaluations.runId, trace.id))
		.orderBy(desc(evaluations.createdAt))
		.limit(1);
	const findings = evaluation
		? await db
				.select()
				.from(evaluationFindings)
				.where(eq(evaluationFindings.evaluationId, evaluation.id))
		: [];
	return ok({ trace, spans, events, artifacts: artifactRows, evaluation, findings });
}

export async function PATCH(event) {
	const userId = requireUserId(event);
	const existing = await findRunForUser(event.params.id, userId);
	if (!existing) notFound('Trace not found');
	const input = await parseJson(event, updateTraceSchema);
	const trace = await finishTrace(event.params.id, {
		status: input.status === 'running' ? 'success' : input.status,
		metadata: input.metadata
	});
	if (!trace) notFound('Trace not found');
	return ok({
		trace: { id: trace.publicId, schemaVersion: trace.schemaVersion, status: trace.status }
	});
}
