import {
	CODEX_DEFAULT_INSTRUCTIONS,
	codexToolNameAliases,
	formatOpenAIResponsesError,
	postOpenAIResponses,
	resolveModelForTransport,
	toCodexToolName
} from '$lib/server/openai-transport';
import type { AgentModelMessage, ModelProviderAdapter } from './types';

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
		const transport = input.openaiTransport ?? {
			kind: 'platform' as const,
			apiKey: input.apiKey
		};
		const model = resolveModelForTransport(transport, input.model) ?? input.model;
		const codexToolNames =
			transport.kind === 'codex' ? codexToolNameAliases(input.tools) : undefined;
		const tools = input.tools.map((tool) => ({
			type: 'function',
			name: codexToolNames ? toCodexToolName(tool.name) : tool.name,
			description: tool.description,
			parameters: tool.inputSchema,
			...(transport.kind === 'platform' ? { strict: false } : {})
		}));
		const body: Record<string, unknown> =
			transport.kind === 'codex'
				? buildCodexResponsesBody(input.messages, { model, tools })
				: {
						model,
						input: mapPlatformInputMessages(input.messages),
						tools
					};
		if (transport.kind === 'platform') {
			if (input.temperature !== undefined) body.temperature = input.temperature;
			body.truncation = 'auto';
		}

		let payload: OpenAIResponsePayload;
		try {
			payload = (await postOpenAIResponses({ transport, body })) as OpenAIResponsePayload;
		} catch (cause) {
			if (cause instanceof Error) throw cause;
			throw new Error(formatOpenAIResponsesError(500, String(cause)));
		}

		const output = payload.output ?? [];
		return {
			id: payload.id,
			text: payload.output_text || textFromOutput(output),
			toolCalls: output.flatMap((item) =>
				item.type === 'function_call' && item.name
					? [
							{
								id: item.call_id ?? item.id ?? item.name,
								name: codexToolNames?.get(item.name) ?? item.name,
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

export function buildCodexResponsesBody(
	messages: AgentModelMessage[],
	base: { model: string; tools: Record<string, unknown>[] }
) {
	const instructions =
		messages
			.filter((message) => message.role === 'system')
			.map((message) => message.content)
			.join('\n\n')
			.trim() || CODEX_DEFAULT_INSTRUCTIONS;
	const conversation = messages.filter((message) => message.role !== 'system');
	return {
		...base,
		instructions,
		input: mapCodexInputMessages(conversation),
		tool_choice: base.tools.length ? 'auto' : 'none',
		parallel_tool_calls: false
	};
}

function mapPlatformInputMessages(messages: AgentModelMessage[]) {
	return messages.map((message) => ({
		role: message.role === 'tool' ? 'user' : message.role,
		content:
			message.role === 'tool'
				? `Tool result for ${message.name ?? message.toolCallId ?? 'tool'}:\n${message.content}`
				: message.content
	}));
}

function mapCodexInputMessages(messages: AgentModelMessage[]) {
	return messages.map((message) => {
		if (message.role === 'tool') {
			return {
				role: 'user',
				content: [
					{
						type: 'input_text',
						text: `Tool result for ${message.name ?? message.toolCallId ?? 'tool'}:\n${message.content}`
					}
				]
			};
		}
		const contentType = message.role === 'assistant' ? 'output_text' : 'input_text';
		return {
			role: message.role,
			content: [{ type: contentType, text: message.content }]
		};
	});
}
