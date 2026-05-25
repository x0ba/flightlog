import { ok, parseJson, notFound } from '$lib/server/http';
import { createSpan } from '$lib/server/traces';
import { createSpanSchema } from '$lib/server/validation';

export async function POST(event) {
	const input = await parseJson(event, createSpanSchema);
	const span = await createSpan(event.params.id, input);
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
