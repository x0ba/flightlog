import Anthropic from '@anthropic-ai/sdk';
import type { ModelProviderAdapter } from './types';

export const anthropicProvider: ModelProviderAdapter = {
	provider: 'anthropic',
	async createResponse(input) {
		const client = new Anthropic({ apiKey: input.apiKey });
		const system = input.messages.find((message) => message.role === 'system')?.content;
		const messages = input.messages
			.filter((message) => message.role !== 'system')
			.map((message) => ({
				role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
				content:
					message.role === 'tool'
						? `Tool result for ${message.name ?? message.toolCallId ?? 'tool'}:\n${message.content}`
						: message.content
			}));
		const response = await client.messages.create({
			model: input.model,
			max_tokens: 2048,
			temperature: input.temperature,
			system,
			messages,
			tools: input.tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				input_schema: tool.inputSchema as Anthropic.Tool.InputSchema
			}))
		});

		const text = response.content
			.filter((block) => block.type === 'text')
			.map((block) => block.text)
			.join('\n');
		const toolCalls = response.content
			.filter((block) => block.type === 'tool_use')
			.map((block) => ({
				id: block.id,
				name: block.name,
				input: block.input
			}));

		return {
			id: response.id,
			text: text || undefined,
			toolCalls,
			raw: response
		};
	}
};
