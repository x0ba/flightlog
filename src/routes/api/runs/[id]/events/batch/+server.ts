import { appendEvents } from '$lib/server/events';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson, requireRunForUser } from '$lib/server/http';
import { batchEventsSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const run = await requireRunForUser(event.params.id, userId, 'Run not found');
	const input = await parseJson(event, batchEventsSchema);
	const rows = await appendEvents(run.id, input.events);
	for (const row of rows) publishRunEvent(run.publicId, { type: 'event', data: row });
	return ok(
		{ events: rows.map((row) => ({ id: row.publicId, sequence: row.sequence })) },
		{ status: 201 }
	);
}
