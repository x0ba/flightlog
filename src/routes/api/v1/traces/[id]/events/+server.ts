import { appendEventSchema } from '$lib/server/validation';
import { appendEvent } from '$lib/server/events';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRun } from '$lib/server/runs';

export async function POST(event) {
	const input = await parseJson(event, appendEventSchema);
	const trace = await findRun(event.params.id);
	if (!trace) notFound('Trace not found');
	const loggedEvent = await appendEvent(trace.id, input);
	return ok(
		{ event: { id: loggedEvent.publicId, sequence: loggedEvent.sequence } },
		{ status: 201 }
	);
}
