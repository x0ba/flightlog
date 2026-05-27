import { ok, parseJson, notFound, requireRunForUser } from '$lib/server/http';
import { requireUserId } from '$lib/server/auth';
import { createSpanForRun } from '$lib/server/traces';
import { createSpanSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const trace = await requireRunForUser(event.params.id, userId, 'Trace not found');
	const input = await parseJson(event, createSpanSchema);
	const span = await createSpanForRun(trace, input);
	if (!span) notFound('Trace not found');
	return ok(
		{
			span: {
				id: span.publicId,
				kind: span.kind,
				name: span.name,
				status: span.status
			}
		},
		{ status: 201 }
	);
}
