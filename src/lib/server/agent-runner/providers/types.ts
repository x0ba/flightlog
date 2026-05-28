import type { OpenAITransport } from '$lib/server/openai-transport';
import type { ToolDefinition } from '$lib/server/tools/registry';

export type AgentModelMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	toolCallId?: string;
	name?: string;
};

export type AgentToolCall = {
	id: string;
	name: string;
	input: unknown;
};

export type AgentModelResult = {
	id?: string;
	text?: string;
	reasoningSummary?: string;
	toolCalls: AgentToolCall[];
	raw?: unknown;
};

export type ModelProviderAdapter = {
	provider: 'openai' | 'anthropic';
	createResponse(input: {
		model: string;
		apiKey: string;
		openaiTransport?: OpenAITransport;
		messages: AgentModelMessage[];
		tools: ToolDefinition[];
		temperature?: number;
	}): Promise<AgentModelResult>;
};
