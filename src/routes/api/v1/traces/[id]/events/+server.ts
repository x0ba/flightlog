import { appendEventSchema } from '$lib/server/validation';
import { appendEvent } from '$lib/server/events';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRunForUser } from '$lib/server/runs';

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, appendEventSchema);
	const trace = await findRunForUser(event.params.id, userId);
	if (!trace) notFound('Trace not found');
	const loggedEvent = await appendEvent(trace.id, input);
	return ok(
		{ event: { id: loggedEvent.publicId, sequence: loggedEvent.sequence } },
		{ status: 201 }
	);
}
