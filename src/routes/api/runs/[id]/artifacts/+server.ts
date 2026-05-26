import { createArtifact } from '$lib/server/artifacts';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, requireRunForUser } from '$lib/server/http';
import { createArtifactSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const run = await requireRunForUser(event.params.id, userId, 'Run not found');
	const input = await parseJson(event, createArtifactSchema);
	const artifact = await createArtifact(run.id, input);
	publishRunEvent(run.publicId, { type: 'artifact', data: { ...artifact, eventSequence: null } });
	return ok({ artifact: { id: artifact.publicId, type: artifact.type } }, { status: 201 });
}
