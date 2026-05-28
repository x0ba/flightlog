import { env } from '$env/dynamic/private';
import type { events, runs, spans } from '$lib/server/db/schema';
import {
	postOpenAIResponses,
	resolveModelForTransport,
	type OpenAITransport
} from '$lib/server/openai-transport';
import { llmEvaluationSchema, type LlmEvaluation } from './types';

const DEFAULT_MODEL = 'gpt-4.1-mini';
const EVAL_SYSTEM_PROMPT =
	'You evaluate agent run logs. Return only JSON matching the requested schema.';

type RunRow = typeof runs.$inferSelect;
type EventRow = typeof events.$inferSelect;
type SpanRow = typeof spans.$inferSelect;

type OpenAIResponsePayload = {
	output_text?: string;
	output?: Array<{
		content?: Array<{
			text?: string;
			type?: string;
		}>;
	}>;
};

export async function runLlmEvaluation(input: {
	run: RunRow;
	events: EventRow[];
	spans?: SpanRow[];
	constraints: string[];
	ruleSummary: unknown;
	transport: OpenAITransport;
}) {
	const timeline = input.events.map((event) => ({
		id: event.publicId,
		sequence: event.sequence,
		type: event.type,
		status: event.status,
		title: event.title,
		message: event.message,
		data: event.data
	}));

	const userContent = JSON.stringify({
		schema: {
			goalCompleted: 'boolean',
			violatedConstraints: 'boolean',
			score: 'integer 0-100',
			summary: 'string',
			explanation: 'string',
			findings: [
				{
					severity: 'info | warning | error',
					category:
						'goal_completion | constraint_violation | repetition | human_approval | tool_failure | other',
					message: 'string',
					eventPublicId: 'optional string'
				}
			]
		},
		goal: input.run.goal,
		constraints: input.constraints,
		ruleSummary: input.ruleSummary,
		timeline,
		spans: input.spans?.map((span) => ({
			id: span.publicId,
			parentSpanId: span.parentSpanId,
			kind: span.kind,
			name: span.name,
			status: span.status,
			input: span.input,
			output: span.output,
			error: span.error,
			attributes: span.attributes
		}))
	});

	const model = resolveModelForTransport(input.transport, env.OPENAI_EVAL_MODEL || DEFAULT_MODEL);

	const body =
		input.transport.kind === 'codex'
			? {
					model,
					instructions: EVAL_SYSTEM_PROMPT,
					input: [
						{
							role: 'user',
							content: [{ type: 'input_text', text: userContent }]
						}
					],
					tools: [],
					tool_choice: 'none',
					parallel_tool_calls: false
				}
			: {
					model,
					input: [
						{ role: 'system', content: EVAL_SYSTEM_PROMPT },
						{ role: 'user', content: userContent }
					],
					text: { format: { type: 'json_object' } }
				};

	const payload = (await postOpenAIResponses({
		transport: input.transport,
		body
	})) as OpenAIResponsePayload;
	const outputText = extractOutputText(payload);
	if (!outputText) throw new Error('OpenAI evaluation returned no text output');
	return {
		skipped: false as const,
		evaluation: llmEvaluationSchema.parse(JSON.parse(stripJsonMarkdownFence(outputText)))
	};
}

function extractOutputText(payload: OpenAIResponsePayload) {
	if (payload.output_text) return payload.output_text;

	return payload.output
		?.flatMap((item) => item.content ?? [])
		.map((content) => content.text)
		.find((text) => text && text.trim().length > 0);
}

function stripJsonMarkdownFence(text: string) {
	return text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
}

export function fallbackEvaluation(input: {
	goalCompleted: boolean;
	violatedConstraints: boolean;
	score: number;
	summary: string;
	explanation: string;
	findings: LlmEvaluation['findings'];
}) {
	return llmEvaluationSchema.parse(input);
}
