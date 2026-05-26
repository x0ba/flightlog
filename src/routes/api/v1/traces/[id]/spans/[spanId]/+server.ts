import { ok, parseJson, notFound } from '$lib/server/http';
import { requireUserId } from '$lib/server/auth';
import { findRunForUser } from '$lib/server/runs';
import { updateSpan } from '$lib/server/traces';
import { updateSpanSchema } from '$lib/server/validation';

export async function PATCH(event) {
	const userId = requireUserId(event);
	const trace = await findRunForUser(event.params.id, userId);
	if (!trace) notFound('Trace not found');
	const input = await parseJson(event, updateSpanSchema);
	const span = await updateSpan(event.params.id, event.params.spanId, input);
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
