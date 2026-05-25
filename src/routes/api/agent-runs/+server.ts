import { resolve } from '$app/paths';
import { createAgentRun } from '$lib/server/agent-runner/service';
import { ok, parseJson } from '$lib/server/http';
import { createAgentRunSchema } from '$lib/server/validation';

export async function POST(event) {
	const input = await parseJson(event, createAgentRunSchema);
	const run = await createAgentRun(input);
	return ok(
		{
			run: {
				id: run.publicId,
				status: run.status,
				streamUrl: resolve(`/api/runs/${run.publicId}/stream`),
				pageUrl: resolve(`/runs/${run.publicId}`)
			}
		},
		{ status: 201 }
	);
}
