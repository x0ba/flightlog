import { createArtifact } from '$lib/server/artifacts';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRun } from '$lib/server/runs';
import { createArtifactSchema } from '$lib/server/validation';

export async function POST(event) {
	const run = await findRun(event.params.id);
	if (!run) notFound('Run not found');
	const input = await parseJson(event, createArtifactSchema);
	const artifact = await createArtifact(run.id, input);
	publishRunEvent(run.publicId, { type: 'artifact', data: { ...artifact, eventSequence: null } });
	return ok({ artifact: { id: artifact.publicId, type: artifact.type } }, { status: 201 });
}
