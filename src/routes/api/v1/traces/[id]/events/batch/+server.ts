import { appendEvents } from '$lib/server/events';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRun } from '$lib/server/runs';
import { batchEventsSchema } from '$lib/server/validation';

export async function POST(event) {
	const input = await parseJson(event, batchEventsSchema);
	const trace = await findRun(event.params.id);
	if (!trace) notFound('Trace not found');
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
