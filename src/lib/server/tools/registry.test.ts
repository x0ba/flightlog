import { afterEach, describe, expect, it, vi } from 'vitest';
import { requiresApproval, selectedTools, toolRegistry } from './registry';

describe('toolRegistry', () => {
	it('evaluates calculator expressions', async () => {
		const result = await toolRegistry['calculator.evaluate'].execute({ expression: '2 + 2 * 3' });
		expect(result).toEqual({ result: 8 });
	});

	it('rejects unsupported calculator characters', async () => {
		await expect(
			toolRegistry['calculator.evaluate'].execute({ expression: 'alert(1)' })
		).rejects.toThrow('unsupported characters');
	});

	it('returns deterministic mock search results', async () => {
		const result = await toolRegistry['web.searchMock'].execute({ query: 'flightlog' });
		expect(result).toMatchObject({
			query: 'flightlog',
			results: expect.arrayContaining([
				expect.objectContaining({ title: expect.stringContaining('flightlog') })
			])
		});
	});

	it('returns current time', async () => {
		const result = await toolRegistry['time.now'].execute({});
		expect(result).toMatchObject({
			iso: expect.any(String),
			display: expect.any(String)
		});
	});

	it('blocks localhost fetch targets', async () => {
		await expect(
			toolRegistry['web.fetchText'].execute({ url: 'http://localhost/admin' })
		).rejects.toThrow('Private and localhost URLs are blocked');
	});

	it('blocks private network fetch targets', async () => {
		await expect(
			toolRegistry['web.fetchText'].execute({ url: 'http://192.168.0.10/internal' })
		).rejects.toThrow('Private and localhost URLs are blocked');
	});

	it('fetches allowed public URLs', async () => {
		const response = new Response('<html><script>x</script><p>Hello world</p></html>', {
			status: 200,
			headers: { 'content-type': 'text/html' }
		});
		Object.defineProperty(response, 'url', { value: 'https://example.com/page' });
		const fetchMock = vi.fn().mockResolvedValue(response);
		vi.stubGlobal('fetch', fetchMock);

		const result = await toolRegistry['web.fetchText'].execute({ url: 'https://example.com/page' });

		expect(fetchMock).toHaveBeenCalledWith(
			new URL('https://example.com/page'),
			expect.objectContaining({ headers: { 'user-agent': 'FlightLog tool-agent/0.1' } })
		);
		expect(result).toMatchObject({
			url: 'https://example.com/page',
			status: 200,
			text: expect.stringContaining('Hello world')
		});
	});
});

describe('selectedTools', () => {
	it('returns all tools by default', () => {
		expect(selectedTools([])).toHaveLength(Object.keys(toolRegistry).length);
	});

	it('throws for unknown tools', () => {
		expect(() => selectedTools(['missing.tool'])).toThrow('Unknown tool: missing.tool');
	});
});

describe('requiresApproval', () => {
	it('always requires approval when policy is always', () => {
		expect(requiresApproval('safe', 'always')).toBe(true);
	});

	it('never requires approval when policy is never', () => {
		expect(requiresApproval('network_write', 'never')).toBe(false);
	});

	it('requires approval for risky tools under risk_based policy', () => {
		expect(requiresApproval('network_write', 'risk_based')).toBe(true);
		expect(requiresApproval('safe', 'risk_based')).toBe(false);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});
