import type { ModelProviderAdapter } from './types';

type OpenAIResponsePayload = {
	id?: string;
	output_text?: string;
	output?: Array<{
		type?: string;
		id?: string;
		call_id?: string;
		name?: string;
		arguments?: string;
		content?: Array<{ type?: string; text?: string }>;
	}>;
};

export const openaiProvider: ModelProviderAdapter = {
	provider: 'openai',
	async createResponse(input) {
		const response = await fetch('https://api.openai.com/v1/responses', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${input.apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model: input.model,
				temperature: input.temperature,
				input: input.messages.map((message) => ({
					role: message.role === 'tool' ? 'user' : message.role,
					content:
						message.role === 'tool'
							? `Tool result for ${message.name ?? message.toolCallId ?? 'tool'}:\n${message.content}`
							: message.content
				})),
				tools: input.tools.map((tool) => ({
					type: 'function',
					name: tool.name,
					description: tool.description,
					parameters: tool.inputSchema,
					strict: false
				})),
				truncation: 'auto'
			})
		});
		if (!response.ok)
			throw new Error(`OpenAI model call failed: ${response.status} ${await response.text()}`);
		const payload = (await response.json()) as OpenAIResponsePayload;
		const output = payload.output ?? [];
		return {
			id: payload.id,
			text: payload.output_text || textFromOutput(output),
			toolCalls: output.flatMap((item) =>
				item.type === 'function_call' && item.name
					? [
							{
								id: item.call_id ?? item.id ?? item.name,
								name: item.name,
								input: parseJson(item.arguments) ?? {}
							}
						]
					: []
			),
			raw: payload
		};
	}
};

function textFromOutput(output: NonNullable<OpenAIResponsePayload['output']>) {
	const chunks = output
		.flatMap((item) => item.content ?? [])
		.map((content) => content.text)
		.filter((text): text is string => Boolean(text));
	return chunks.join('\n') || undefined;
}

function parseJson(value: unknown) {
	if (typeof value !== 'string' || !value) return undefined;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}
