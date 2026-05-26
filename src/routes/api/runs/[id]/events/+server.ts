import { appendEvent } from '$lib/server/events';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRunForUser } from '$lib/server/runs';
import { appendEventSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const run = await findRunForUser(event.params.id, userId);
	if (!run) notFound('Run not found');
	const input = await parseJson(event, appendEventSchema);
	const row = await appendEvent(run.id, input);
	publishRunEvent(run.publicId, { type: 'event', data: row });
	return ok({ event: { id: row.publicId, sequence: row.sequence } }, { status: 201 });
}
