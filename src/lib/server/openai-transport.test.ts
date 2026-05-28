import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	assembleCodexResponse,
	codexToolNameAliases,
	collectCodexResponseFromSseText,
	formatOpenAIResponsesError,
	looksLikeSseBody,
	parseSseTextEvents,
	prepareCodexResponsesPayload,
	resolveModelForTransport,
	openaiTransportForChatGptOAuth,
	toCodexToolName
} from './openai-transport';

const codexStreamFixture = readFileSync(
	new URL('./fixtures/codex-responses-stream.sse', import.meta.url),
	'utf8'
);

describe('resolveModelForTransport', () => {
	it('maps platform models to a Codex default for ChatGPT OAuth', () => {
		const transport = openaiTransportForChatGptOAuth('token');
		expect(resolveModelForTransport(transport, 'gpt-4.1')).toBe('gpt-5.3-codex');
		expect(resolveModelForTransport(transport, 'computer-use-preview')).toBe('gpt-5.3-codex');
	});

	it('keeps explicit Codex model ids', () => {
		const transport = openaiTransportForChatGptOAuth('token');
		expect(resolveModelForTransport(transport, 'gpt-5.4')).toBe('gpt-5.4');
	});

	it('does not remap platform API key models', () => {
		expect(resolveModelForTransport(undefined, 'gpt-4.1')).toBe('gpt-4.1');
	});
});

describe('formatOpenAIResponsesError', () => {
	it('surfaces JSON detail from Codex backend', () => {
		expect(
			formatOpenAIResponsesError(400, JSON.stringify({ detail: 'Unsupported parameter: metadata' }))
		).toContain('Unsupported parameter: metadata');
	});

	it('labels empty bodies clearly', () => {
		expect(formatOpenAIResponsesError(400, '')).toContain('empty response body');
	});
});

describe('toCodexToolName', () => {
	it('replaces dots and other invalid characters for Codex tool names', () => {
		expect(toCodexToolName('calculator.evaluate')).toBe('calculator_evaluate');
		expect(toCodexToolName('web.fetchText')).toBe('web_fetchText');
	});

	it('builds a reverse map for tool call handling', () => {
		const aliases = codexToolNameAliases([
			{ name: 'calculator.evaluate' },
			{ name: 'time.now' }
		]);
		expect(aliases.get('calculator_evaluate')).toBe('calculator.evaluate');
		expect(aliases.get('time_now')).toBe('time.now');
	});
});

describe('prepareCodexResponsesPayload', () => {
	it('matches the documented Codex /responses request shape', () => {
		const payload = prepareCodexResponsesPayload({
			model: 'gpt-5.3-codex',
			instructions: 'Be concise.',
			input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
			tools: [
				{
					type: 'function',
					name: 'calculator_evaluate',
					description: 'Evaluate math',
					parameters: { type: 'object', properties: {} }
				}
			],
			tool_choice: 'auto'
		});
		expect(payload).toMatchObject({
			model: 'gpt-5.3-codex',
			instructions: 'Be concise.',
			stream: true,
			store: false,
			tool_choice: 'auto',
			parallel_tool_calls: false
		});
	});

	it('rejects tool names that violate the Codex name pattern', () => {
		expect(() =>
			prepareCodexResponsesPayload({
				model: 'gpt-5.3-codex',
				instructions: 'Test',
				input: [],
				tools: [{ type: 'function', name: 'bad.tool', description: 'x', parameters: {} }]
			})
		).toThrow('invalid');
	});
});

describe('parseSseTextEvents', () => {
	it('detects SSE bodies instead of attempting JSON.parse', () => {
		expect(looksLikeSseBody(codexStreamFixture)).toBe(true);
		expect(() => JSON.parse(codexStreamFixture)).toThrow();
	});

	it('parses event/data SSE blocks from the Codex backend', () => {
		const events = parseSseTextEvents(codexStreamFixture);
		expect(events.some((event) => event.type === 'response.completed')).toBe(true);
		expect(events.some((event) => event.type === 'response.content_part.delta')).toBe(true);
	});

	it('collects a fixture stream into a Responses-shaped payload', () => {
		const response = collectCodexResponseFromSseText(codexStreamFixture);
		expect(response.id).toBe('resp_fixture_1');
		expect(response.output_text).toBe('Hi');
	});
});

describe('assembleCodexResponse', () => {
	it('collects streamed text deltas into output_text', () => {
		const response = assembleCodexResponse([
			{ type: 'response.output_text.delta', delta: 'Hello' },
			{ type: 'response.output_text.delta', delta: ' world' },
			{
				type: 'response.completed',
				response: { id: 'resp_1', output: [], status: 'completed' }
			}
		]);
		expect(response.output_text).toBe('Hello world');
		expect(response.id).toBe('resp_1');
	});

	it('surfaces stream failure events', () => {
		expect(() =>
			assembleCodexResponse([
				{
					type: 'response.failed',
					response: { error: { message: 'Rate limit reached' } }
				}
			])
		).toThrow('Rate limit reached');
	});
});
