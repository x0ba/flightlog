import { createArtifact } from '$lib/server/artifacts';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRunForUser } from '$lib/server/runs';
import { createArtifactSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const run = await findRunForUser(event.params.id, userId);
	if (!run) notFound('Run not found');
	const input = await parseJson(event, createArtifactSchema);
	const artifact = await createArtifact(run.id, input);
	publishRunEvent(run.publicId, { type: 'artifact', data: { ...artifact, eventSequence: null } });
	return ok({ artifact: { id: artifact.publicId, type: artifact.type } }, { status: 201 });
}
