import { runStatusSchema } from '$lib/server/validation';
import { requireUserId } from '$lib/server/auth';
import { createRun, listRuns } from '$lib/server/runs';
import { createRunSchema } from '$lib/server/validation';
import { ok, parseJson } from '$lib/server/http';
import { getPostHogClient } from '$lib/server/posthog';

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, createRunSchema);
	const run = await createRun({ ...input, ownerUserId: userId });

	const posthog = getPostHogClient();
	posthog.capture({
		distinctId: event.request.headers.get('x-posthog-distinct-id') || userId,
		event: 'api_run_created',
		properties: {
			run_id: run.publicId,
			run_status: run.status,
			$session_id: event.request.headers.get('x-posthog-session-id') || undefined
		}
	});

	return ok({ run: { id: run.publicId, status: run.status } }, { status: 201 });
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
