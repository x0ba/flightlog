import { appendEvents } from '$lib/server/events';
import { publishRunEvent } from '$lib/server/agent-runner/stream';
import { ok, parseJson, notFound } from '$lib/server/http';
import { findRun } from '$lib/server/runs';
import { batchEventsSchema } from '$lib/server/validation';

export async function POST(event) {
	const run = await findRun(event.params.id);
	if (!run) notFound('Run not found');
	const input = await parseJson(event, batchEventsSchema);
	const rows = await appendEvents(run.id, input.events);
	for (const row of rows) publishRunEvent(run.publicId, { type: 'event', data: row });
	return ok(
		{ events: rows.map((row) => ({ id: row.publicId, sequence: row.sequence })) },
		{ status: 201 }
	);
}
