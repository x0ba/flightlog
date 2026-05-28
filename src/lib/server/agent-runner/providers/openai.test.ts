import { describe, expect, it } from 'vitest';
import { CODEX_DEFAULT_INSTRUCTIONS } from '$lib/server/openai-transport';
import { buildCodexResponsesBody } from './openai';

describe('buildCodexResponsesBody', () => {
	it('moves system prompts into instructions', () => {
		const body = buildCodexResponsesBody(
			[
				{ role: 'system', content: 'Always be brief.' },
				{ role: 'user', content: 'List three colors.' }
			],
			{ model: 'gpt-5.3-codex', tools: [] }
		);
		expect(body.instructions).toBe('Always be brief.');
		expect(body.input).toEqual([
			{
				role: 'user',
				content: [{ type: 'input_text', text: 'List three colors.' }]
			}
		]);
	});

	it('falls back to default instructions when no system prompt is present', () => {
		const body = buildCodexResponsesBody([{ role: 'user', content: 'Hello' }], {
			model: 'gpt-5.3-codex',
			tools: []
		});
		expect(body.instructions).toBe(CODEX_DEFAULT_INSTRUCTIONS);
	});
});
