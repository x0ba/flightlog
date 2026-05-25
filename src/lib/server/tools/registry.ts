import { z } from 'zod';

export type ToolRisk = 'safe' | 'network_read' | 'network_write' | 'filesystem_write';

export type ToolDefinition = {
	name: string;
	description: string;
	risk: ToolRisk;
	inputSchema: Record<string, unknown>;
	execute(input: unknown): Promise<unknown>;
};

const calculatorSchema = z.object({ expression: z.string().min(1).max(200) });
const fetchTextSchema = z.object({ url: z.string().url() });
const searchSchema = z.object({ query: z.string().min(1).max(200) });
const timeSchema = z.object({ timezone: z.string().min(1).optional() });

export const toolRegistry: Record<string, ToolDefinition> = {
	'calculator.evaluate': {
		name: 'calculator.evaluate',
		description: 'Evaluate a deterministic arithmetic expression with numbers and math operators.',
		risk: 'safe',
		inputSchema: {
			type: 'object',
			properties: { expression: { type: 'string' } },
			required: ['expression'],
			additionalProperties: false
		},
		async execute(input) {
			const { expression } = calculatorSchema.parse(input);
			if (!/^[\d\s+\-*/().%^]+$/.test(expression)) {
				throw new Error('Expression contains unsupported characters');
			}
			const jsExpression = expression.replaceAll('^', '**');
			const result = Function(`"use strict"; return (${jsExpression});`)();
			if (typeof result !== 'number' || !Number.isFinite(result)) {
				throw new Error('Expression did not produce a finite number');
			}
			return { result };
		}
	},
	'web.fetchText': {
		name: 'web.fetchText',
		description: 'Fetch text from a public HTTP(S) URL. Private and localhost URLs are blocked.',
		risk: 'network_read',
		inputSchema: {
			type: 'object',
			properties: { url: { type: 'string' } },
			required: ['url'],
			additionalProperties: false
		},
		async execute(input) {
			const { url } = fetchTextSchema.parse(input);
			const parsed = new URL(url);
			if (!['http:', 'https:'].includes(parsed.protocol))
				throw new Error('Only HTTP(S) URLs are allowed');
			if (isBlockedHost(parsed.hostname)) throw new Error('Private and localhost URLs are blocked');
			const response = await fetch(parsed, {
				headers: { 'user-agent': 'FlightLog tool-agent/0.1' },
				redirect: 'follow'
			});
			const contentType = response.headers.get('content-type') ?? '';
			const body = (await response.text())
				.replace(/<script[\s\S]*?<\/script>/gi, '')
				.replace(/<style[\s\S]*?<\/style>/gi, '')
				.replace(/<[^>]+>/g, ' ');
			return {
				url: response.url,
				status: response.status,
				contentType,
				text: body.replace(/\s+/g, ' ').trim().slice(0, 8000)
			};
		}
	},
	'web.searchMock': {
		name: 'web.searchMock',
		description: 'Return deterministic mock search results for local agent development.',
		risk: 'safe',
		inputSchema: {
			type: 'object',
			properties: { query: { type: 'string' } },
			required: ['query'],
			additionalProperties: false
		},
		async execute(input) {
			const { query } = searchSchema.parse(input);
			return {
				query,
				results: [
					{
						title: `FlightLog result for ${query}`,
						url: 'https://example.com/flightlog',
						snippet: 'Mock search result for local agent runs.'
					},
					{
						title: 'Provider documentation',
						url: 'https://example.com/providers',
						snippet: 'Mock provider and model reference.'
					}
				]
			};
		}
	},
	'time.now': {
		name: 'time.now',
		description: 'Return the current date and time.',
		risk: 'safe',
		inputSchema: {
			type: 'object',
			properties: { timezone: { type: 'string' } },
			additionalProperties: false
		},
		async execute(input) {
			const { timezone } = timeSchema.parse(input ?? {});
			const now = new Date();
			return {
				iso: now.toISOString(),
				display: new Intl.DateTimeFormat('en', {
					dateStyle: 'medium',
					timeStyle: 'long',
					timeZone: timezone
				}).format(now)
			};
		}
	}
} satisfies Record<string, ToolDefinition>;

export function selectedTools(names: string[]) {
	const unique = names.length ? [...new Set(names)] : Object.keys(toolRegistry);
	return unique.map((name) => {
		const tool = toolRegistry[name];
		if (!tool) throw new Error(`Unknown tool: ${name}`);
		return tool;
	});
}

export function requiresApproval(risk: ToolRisk, policy: 'risk_based' | 'always' | 'never') {
	if (policy === 'always') return true;
	if (policy === 'never') return false;
	return risk === 'network_write' || risk === 'filesystem_write';
}

function isBlockedHost(hostname: string) {
	const normalized = hostname.toLowerCase();
	return (
		normalized === 'localhost' ||
		normalized === '127.0.0.1' ||
		normalized === '0.0.0.0' ||
		normalized === '::1' ||
		normalized.startsWith('10.') ||
		normalized.startsWith('192.168.') ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
	);
}
