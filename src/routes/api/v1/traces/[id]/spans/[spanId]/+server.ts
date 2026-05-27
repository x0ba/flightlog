import { ok, parseJson, notFound, requireRunForUser } from '$lib/server/http';
import { requireUserId } from '$lib/server/auth';
import { updateSpanForRun } from '$lib/server/traces';
import { updateSpanSchema } from '$lib/server/validation';

export async function PATCH(event) {
	const userId = requireUserId(event);
	const trace = await requireRunForUser(event.params.id, userId, 'Trace not found');
	const input = await parseJson(event, updateSpanSchema);
	const span = await updateSpanForRun(trace, event.params.spanId, input);
	if (!span) notFound('Span not found');
	return ok({
		span: {
			id: span.publicId,
			kind: span.kind,
			name: span.name,
			status: span.status
		}
	});
}
