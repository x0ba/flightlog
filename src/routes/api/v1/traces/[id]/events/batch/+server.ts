import { appendEvents } from '$lib/server/events';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, requireRunForUser } from '$lib/server/http';
import { batchEventsSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const trace = await requireRunForUser(event.params.id, userId, 'Trace not found');
	const input = await parseJson(event, batchEventsSchema);
	const events = await appendEvents(trace.id, input.events);
	return ok(
		{
			events: events.map((loggedEvent) => ({
				id: loggedEvent.publicId,
				sequence: loggedEvent.sequence
			}))
		},
		{ status: 201 }
	);
}
