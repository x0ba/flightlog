import { ok, parseJson } from '$lib/server/http';
import { listRuns } from '$lib/server/runs';
import { createTrace } from '$lib/server/traces';
import { createTraceSchema, runStatusSchema } from '$lib/server/validation';

export async function POST(event) {
	const input = await parseJson(event, createTraceSchema);
	const trace = await createTrace(input);
	return ok(
		{
			trace: {
				id: trace.publicId,
				schemaVersion: trace.schemaVersion,
				status: trace.status
			}
		},
		{ status: 201 }
	);
}

export async function GET({ url }) {
	const statusParam = url.searchParams.get('status');
	const status = statusParam ? runStatusSchema.parse(statusParam) : undefined;
	const q = url.searchParams.get('q') ?? undefined;
	const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
	const offset = Number(url.searchParams.get('offset') ?? 0);
	return ok(await listRuns({ status, q, limit, offset }));
}
