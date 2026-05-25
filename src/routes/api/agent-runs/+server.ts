import { resolve } from '$app/paths';
import { error } from '@sveltejs/kit';
import { createAgentRun } from '$lib/server/agent-runner/service';
import { ok, parseJson } from '$lib/server/http';
import { createAgentRunSchema } from '$lib/server/validation';

export async function POST(event) {
	const input = await parseJson(event, createAgentRunSchema);
	if (input.runMode === 'tool_agent' && (!input.credentialId || !input.model)) {
		throw error(400, { message: 'Tool-agent runs require credentialId and model.' });
	}
	if (input.runMode === 'browser' && input.provider !== 'openai') {
		throw error(400, { message: 'Browser runs currently require OpenAI.' });
	}
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
