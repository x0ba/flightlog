import { appendEventSchema } from '$lib/server/validation';
import { appendEvent } from '$lib/server/events';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, requireRunForUser } from '$lib/server/http';

export async function POST(event) {
	const userId = requireUserId(event);
	const trace = await requireRunForUser(event.params.id, userId, 'Trace not found');
	const input = await parseJson(event, appendEventSchema);
	const loggedEvent = await appendEvent(trace.id, input);
	return ok(
		{ event: { id: loggedEvent.publicId, sequence: loggedEvent.sequence } },
		{ status: 201 }
	);
}
