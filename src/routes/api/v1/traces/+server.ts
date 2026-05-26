import { ok, parseJson } from '$lib/server/http';
import { requireUserId } from '$lib/server/auth';
import { listRuns } from '$lib/server/runs';
import { createTrace } from '$lib/server/traces';
import { createTraceSchema, runStatusSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, createTraceSchema);
	const trace = await createTrace(userId, input);
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

export async function GET(event) {
	const userId = requireUserId(event);
	const { url } = event;
	const statusParam = url.searchParams.get('status');
	const status = statusParam ? runStatusSchema.parse(statusParam) : undefined;
	const q = url.searchParams.get('q') ?? undefined;
	const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
	const offset = Number(url.searchParams.get('offset') ?? 0);
	return ok(await listRuns({ ownerUserId: userId, status, q, limit, offset }));
}
