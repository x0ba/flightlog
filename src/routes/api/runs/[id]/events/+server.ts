import { appendEvent } from '$lib/server/events';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, requireRunForUser } from '$lib/server/http';
import { appendEventSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const run = await requireRunForUser(event.params.id, userId, 'Run not found');
	const input = await parseJson(event, appendEventSchema);
	const row = await appendEvent(run.id, input);
	publishRunEvent(run.publicId, { type: 'event', data: row });
	return ok({ event: { id: row.publicId, sequence: row.sequence } }, { status: 201 });
}
