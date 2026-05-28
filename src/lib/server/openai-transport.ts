import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { chatgptAccountIdFromAccessToken } from '$lib/server/openai-oauth/codex-identity';

export const OPENAI_CODEX_RESPONSES_BASE_URL = 'https://chatgpt.com/backend-api/codex';
export const CODEX_DEFAULT_MODEL = 'gpt-5.3-codex';
export const CODEX_DEFAULT_INSTRUCTIONS =
	'You are an autonomous tool-using agent. Use available tools when useful, then provide a concise final answer.';
/** Codex Responses API tool names must match this pattern (no dots). */
export const CODEX_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const CODEX_ORIGINATOR = 'codex_cli_rs';

export function toCodexToolName(name: string) {
	if (!name) {
		throw new Error('Tool name must not be empty.');
	}
	return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function codexToolNameAliases(tools: { name: string }[]) {
	const toCanonical = new Map<string, string>();
	for (const tool of tools) {
		const codexName = toCodexToolName(tool.name);
		const existing = toCanonical.get(codexName);
		if (existing) {
			throw new Error(
				`Tool names "${existing}" and "${tool.name}" both map to the Codex name "${codexName}". Rename one to avoid ambiguous tool call routing.`
			);
		}
		toCanonical.set(codexName, tool.name);
	}
	return toCanonical;
}

export type OpenAITransport =
	| { kind: 'platform'; apiKey: string }
	| { kind: 'codex'; accessToken: string; chatgptAccountId?: string };

export function openaiTransportForChatGptOAuth(accessToken: string): OpenAITransport {
	return {
		kind: 'codex',
		accessToken,
		chatgptAccountId: chatgptAccountIdFromAccessToken(accessToken)
	};
}

export function assertChatGptSupportsBrowserRuns(transport: OpenAITransport | undefined) {
	if (transport?.kind === 'codex') {
		throw new Error(
			'Browser runs need an OpenAI API key (computer-use is not available on ChatGPT sign-in). Use tool-agent mode or add a platform API key under Runs → Keys.'
		);
	}
}

export function resolveModelForTransport(transport: OpenAITransport | undefined, model?: string) {
	if (transport?.kind !== 'codex') {
		return model;
	}
	const trimmed = model?.trim();
	if (!trimmed || trimmed === 'computer-use-preview' || trimmed.includes('computer')) {
		return CODEX_DEFAULT_MODEL;
	}
	if (/^gpt-4/i.test(trimmed)) {
		return CODEX_DEFAULT_MODEL;
	}
	return trimmed;
}

export function createOpenAIClient(transport: OpenAITransport) {
	if (transport.kind === 'codex') {
		throw new Error('Use postOpenAIResponses for ChatGPT OAuth (Codex backend).');
	}
	return new OpenAI({ apiKey: transport.apiKey });
}

export function buildCodexHeaders(
	transport: Extract<OpenAITransport, { kind: 'codex' }>,
	sessionId: string = randomUUID()
) {
	const headers: Record<string, string> = {
		authorization: `Bearer ${transport.accessToken}`,
		'content-type': 'application/json',
		accept: 'text/event-stream',
		'openai-beta': 'responses=experimental',
		originator: CODEX_ORIGINATOR,
		session_id: sessionId
	};
	if (transport.chatgptAccountId) {
		headers['chatgpt-account-id'] = transport.chatgptAccountId;
	}
	return headers;
}

export function codexResponsesRequestInit(
	transport: Extract<OpenAITransport, { kind: 'codex' }>,
	sessionId: string = randomUUID()
) {
	return {
		url: `${OPENAI_CODEX_RESPONSES_BASE_URL}/responses`,
		headers: buildCodexHeaders(transport, sessionId)
	};
}

export function formatOpenAIResponsesError(status: number, body: string) {
	const detail = parseResponsesErrorDetail(body);
	if (
		status === 401 &&
		body.includes('api.responses.write') &&
		body.includes('insufficient permissions')
	) {
		return [
			'ChatGPT sign-in cannot call api.openai.com/v1/responses (missing api.responses.write).',
			'Reconnect ChatGPT under Runs → Keys, or use a platform API key for this run.'
		].join(' ');
	}
	if (status === 400 && detail) {
		if (detail.includes('Unsupported model')) {
			return `ChatGPT backend rejected model: ${detail}. Try ${CODEX_DEFAULT_MODEL} or another Codex model.`;
		}
		if (detail.includes('Unsupported parameter')) {
			return `ChatGPT backend rejected request: ${detail}`;
		}
		return `ChatGPT backend error (${status}): ${detail}`;
	}
	if (detail) {
		return `OpenAI model call failed (${status}): ${detail}`;
	}
	if (body.trim()) {
		return `OpenAI model call failed: ${status} ${body}`;
	}
	return `OpenAI model call failed: ${status} (empty response body)`;
}

function parseResponsesErrorDetail(body: string) {
	if (!body.trim()) return undefined;
	try {
		const parsed = JSON.parse(body) as {
			detail?: unknown;
			error?: { message?: unknown };
		};
		if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
			return parsed.detail.trim();
		}
		if (typeof parsed.error?.message === 'string' && parsed.error.message.trim()) {
			return parsed.error.message.trim();
		}
	} catch {
		// fall through
	}
	return body.length <= 500 ? body.trim() : undefined;
}

type CodexSseEvent = Record<string, unknown>;

/**
 * Validates and normalizes a POST /codex/responses body.
 * @see https://github.com/B4PT0R/codex-backend-sdk/blob/main/docs/backend-api.md
 */
export function prepareCodexResponsesPayload(body: Record<string, unknown>) {
	if (typeof body.model !== 'string' || !body.model.trim()) {
		throw new Error('Codex request requires a non-empty model.');
	}
	if (typeof body.instructions !== 'string') {
		throw new Error('Codex request requires instructions.');
	}
	if (!Array.isArray(body.input)) {
		throw new Error('Codex request requires input to be an array.');
	}
	const tools = Array.isArray(body.tools) ? body.tools : [];
	for (const tool of tools) {
		if (!isRecord(tool) || tool.type !== 'function' || typeof tool.name !== 'string') {
			throw new Error('Codex tools must use OpenAI function format with a name.');
		}
		if (!CODEX_TOOL_NAME_PATTERN.test(tool.name)) {
			throw new Error(
				`Codex tool name "${tool.name}" is invalid. Names must match ${CODEX_TOOL_NAME_PATTERN.source}.`
			);
		}
	}
	const toolChoice = tools.length ? (body.tool_choice ?? 'auto') : 'none';
	return {
		model: body.model.trim(),
		instructions: body.instructions,
		input: body.input,
		tools,
		tool_choice: toolChoice,
		parallel_tool_calls: body.parallel_tool_calls ?? false,
		store: false,
		stream: true
	};
}

/** Codex /responses is stream-only; the HTTP body is always SSE (often with `event:` lines). */
export function looksLikeSseBody(text: string) {
	const trimmed = text.trimStart();
	return trimmed.startsWith('event:') || trimmed.startsWith('data:');
}

/** Codex backend rejects several platform-only fields (metadata, truncation, reasoning, etc.). */
export async function postOpenAIResponses(input: {
	transport: OpenAITransport;
	body: Record<string, unknown>;
	sessionId?: string;
}) {
	const { transport, body, sessionId } = input;
	if (transport.kind === 'platform') {
		const response = await fetch('https://api.openai.com/v1/responses', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${transport.apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify(body)
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(formatOpenAIResponsesError(response.status, text));
		}
		if (looksLikeSseBody(text)) {
			return collectCodexResponseFromSseText(text);
		}
		return JSON.parse(text) as unknown;
	}

	const codexBody = prepareCodexResponsesPayload(body);
	const { url, headers } = codexResponsesRequestInit(transport, sessionId);
	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(codexBody)
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(formatOpenAIResponsesError(response.status, text));
	}
	if (!text.trim()) {
		throw new Error(formatOpenAIResponsesError(response.status, ''));
	}
	if (looksLikeSseBody(text)) {
		return collectCodexResponseFromSseText(text);
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new Error(
			'ChatGPT backend returned a non-JSON, non-SSE response. Expected Server-Sent Events from POST /codex/responses.'
		);
	}
}

export async function collectCodexResponseFromSse(body: ReadableStream<Uint8Array>) {
	const text = await readStreamToText(body);
	return collectCodexResponseFromSseText(text);
}

export function collectCodexResponseFromSseText(text: string) {
	const events = parseSseTextEvents(text);
	if (!events.length) {
		throw new Error('ChatGPT backend returned an empty SSE stream.');
	}
	return assembleCodexResponse(events);
}

export function parseSseTextEvents(text: string) {
	const normalized = text.replace(/\r\n/g, '\n');
	const events: CodexSseEvent[] = [];
	let eventName: string | undefined;
	let dataLines: string[] = [];

	const flush = () => {
		const payload = loadsSseDataLines(dataLines, eventName);
		eventName = undefined;
		dataLines = [];
		if (payload) events.push(payload);
	};

	for (const line of normalized.split('\n')) {
		if (line === '') {
			flush();
			continue;
		}
		if (line.startsWith('event:')) {
			eventName = line.slice('event:'.length).trim();
		} else if (line.startsWith('data:')) {
			dataLines.push(line.slice('data:'.length).trimStart());
		}
	}
	flush();
	return events;
}

function loadsSseDataLines(dataLines: string[], eventName?: string) {
	if (!dataLines.length) return undefined;
	const data = dataLines.join('\n');
	if (data === '[DONE]') return undefined;
	try {
		const parsed = JSON.parse(data) as unknown;
		if (!parsed || typeof parsed !== 'object') return undefined;
		const payload = parsed as CodexSseEvent;
		if (eventName && typeof payload.type !== 'string') {
			payload.type = eventName;
		}
		return payload;
	} catch {
		return undefined;
	}
}

async function readStreamToText(body: ReadableStream<Uint8Array>) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let text = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		text += decoder.decode(value, { stream: true });
	}
	return text + decoder.decode();
}

export function assembleCodexResponse(events: CodexSseEvent[]) {
	const output: Record<string, unknown>[] = [];
	const textParts: string[] = [];
	let completed: CodexSseEvent | undefined;

	for (const event of events) {
		const type = typeof event.type === 'string' ? event.type : '';
		if (type === 'response.output_text.delta' || type === 'response.content_part.delta') {
			textParts.push(deltaTextFromEvent(event));
		} else if (type === 'response.output_item.done' && isRecord(event.item)) {
			output.push(event.item);
		} else if (type === 'response.completed') {
			completed = responseFromCompletedEvent(event);
		} else if (type === 'response.failed' || type === 'error') {
			throw new Error(codexStreamErrorMessage(event));
		}
	}

	if (!completed) {
		throw new Error('ChatGPT backend SSE stream ended without a response.completed event.');
	}
	const assembledOutput =
		(Array.isArray(completed.output)
			? (completed.output as Record<string, unknown>[])
			: undefined) ?? output;
	const outputText =
		(typeof completed.output_text === 'string' && completed.output_text) ||
		textParts.join('') ||
		textFromOutputItems(assembledOutput);

	return {
		...completed,
		id: completed.id,
		output: assembledOutput,
		output_text: outputText
	};
}

function deltaTextFromEvent(event: CodexSseEvent) {
	const delta = event.delta;
	if (typeof delta === 'string') return delta;
	if (isRecord(delta) && typeof delta.text === 'string') return delta.text;
	return '';
}

function responseFromCompletedEvent(event: CodexSseEvent) {
	const response = event.response;
	return isRecord(response) ? response : event;
}

function codexStreamErrorMessage(event: CodexSseEvent) {
	const response = isRecord(event.response) ? event.response : undefined;
	const error = isRecord(event.error)
		? event.error
		: isRecord(response?.error)
			? response.error
			: undefined;
	if (typeof error?.message === 'string' && error.message.trim()) {
		return error.message.trim();
	}
	return 'ChatGPT backend stream failed.';
}

function textFromOutputItems(output: Record<string, unknown>[]) {
	const chunks = output
		.flatMap((item) => (Array.isArray(item.content) ? item.content : []))
		.map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
		.filter(Boolean);
	return chunks.join('\n') || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @deprecated Use formatOpenAIResponsesError */
export function openaiResponsesErrorMessage(status: number, body: string) {
	return formatOpenAIResponsesError(status, body);
}
