import { ok, parseJson, notFound } from '$lib/server/http';
import { updateSpan } from '$lib/server/traces';
import { updateSpanSchema } from '$lib/server/validation';

export async function PATCH(event) {
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
