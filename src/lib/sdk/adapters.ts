import type { FlightLogSpan, FlightLogTrace } from './client';

type ProviderMetadata = {
	provider: 'openai' | 'anthropic';
	framework?: 'native' | 'ai-sdk' | 'langchain' | 'custom';
	model?: string;
	raw?: unknown;
	[key: string]: unknown;
};

type InstrumentedCallInput<T> = {
	trace: FlightLogTrace;
	name: string;
	input?: unknown;
	metadata: ProviderMetadata;
	call: (span: FlightLogSpan) => Promise<T>;
};

export async function instrumentModelCall<T>({
	trace,
	name,
	input,
	metadata,
	call
}: InstrumentedCallInput<T>) {
	const span = await trace.logModelCall({ name, input, attributes: metadata });
	try {
		const output = await call(span);
		await span.complete(output, metadata);
		return output;
	} catch (cause) {
		await span.fail(errorPayload(cause), metadata);
		throw cause;
	}
}

export async function instrumentToolCall<T>({
	trace,
	name,
	input,
	metadata,
	call
}: InstrumentedCallInput<T>) {
	const span = await trace.logToolCall({ name, input, attributes: metadata });
	try {
		const output = await call(span);
		await span.complete(output, metadata);
		return output;
	} catch (cause) {
		await span.fail(errorPayload(cause), metadata);
		throw cause;
	}
}

export function openAIAttributes(input: {
	framework?: 'native' | 'ai-sdk' | 'langchain' | 'custom';
	model?: string;
	responseId?: string;
	raw?: unknown;
	[key: string]: unknown;
}) {
	return {
		...input,
		provider: 'openai',
		framework: input.framework ?? 'native'
	} satisfies ProviderMetadata;
}

export function anthropicAttributes(input: {
	framework?: 'native' | 'ai-sdk' | 'langchain' | 'custom';
	model?: string;
	messageId?: string;
	raw?: unknown;
	[key: string]: unknown;
}) {
	return {
		...input,
		provider: 'anthropic',
		framework: input.framework ?? 'native'
	} satisfies ProviderMetadata;
}

export function langChainAttributes(input: {
	provider?: 'openai' | 'anthropic';
	model?: string;
	runId?: string;
	raw?: unknown;
	[key: string]: unknown;
}) {
	return {
		...input,
		provider: input.provider ?? 'openai',
		framework: 'langchain'
	} satisfies ProviderMetadata;
}

export function aiSdkAttributes(input: {
	provider?: 'openai' | 'anthropic';
	model?: string;
	toolCallId?: string;
	raw?: unknown;
	[key: string]: unknown;
}) {
	return {
		...input,
		provider: input.provider ?? 'openai',
		framework: 'ai-sdk'
	} satisfies ProviderMetadata;
}

export const vercelAIAttributes = aiSdkAttributes;

function errorPayload(cause: unknown) {
	if (cause instanceof Error) {
		return {
			name: cause.name,
			message: cause.message,
			stack: cause.stack
		};
	}
	return { message: String(cause) };
}
