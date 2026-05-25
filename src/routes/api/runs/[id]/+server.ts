import { eq, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artifacts, evaluationFindings, evaluations } from '$lib/server/db/schema';
import { listEvents } from '$lib/server/events';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRun, updateRun } from '$lib/server/runs';
import { updateRunSchema } from '$lib/server/validation';

export async function GET({ params }) {
	const run = await findRun(params.id);
	if (!run) notFound('Run not found');
	const events = await listEvents(run.id);
	const artifactRows = await db.select().from(artifacts).where(eq(artifacts.runId, run.id));
	const [evaluation] = await db
		.select()
		.from(evaluations)
		.where(eq(evaluations.runId, run.id))
		.orderBy(desc(evaluations.createdAt))
		.limit(1);
	const findings = evaluation
		? await db
				.select()
				.from(evaluationFindings)
				.where(eq(evaluationFindings.evaluationId, evaluation.id))
		: [];
	return ok({ run, events, artifacts: artifactRows, evaluation, findings });
}

export async function PATCH(event) {
	const input = await parseJson(event, updateRunSchema);
	const run = await updateRun(event.params.id, input);
	if (!run) notFound('Run not found');
	publishRunEvent(run.publicId, { type: 'run', data: run });
	if (run.status !== 'running') publishRunEvent(run.publicId, { type: 'done', data: { run } });
	return ok({ run: { id: run.publicId, status: run.status } });
}
