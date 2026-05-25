import { env } from '$env/dynamic/private';
import type { events, runs, spans } from '$lib/server/db/schema';
import { llmEvaluationSchema, type LlmEvaluation } from './types';

const DEFAULT_MODEL = 'gpt-4.1-mini';

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
}) {
	if (!env.OPENAI_API_KEY) return { skipped: true as const, reason: 'OPENAI_API_KEY is not set' };

	const timeline = input.events.map((event) => ({
		id: event.publicId,
		sequence: event.sequence,
		type: event.type,
		status: event.status,
		title: event.title,
		message: event.message,
		data: event.data
	}));

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${env.OPENAI_API_KEY}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: env.OPENAI_EVAL_MODEL || DEFAULT_MODEL,
			input: [
				{
					role: 'system',
					content: 'You evaluate agent run logs. Return only JSON matching the requested schema.'
				},
				{
					role: 'user',
					content: JSON.stringify({
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
					})
				}
			],
			text: { format: { type: 'json_object' } }
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI evaluation failed: ${response.status} ${await response.text()}`);
	}

	const payload = (await response.json()) as OpenAIResponsePayload;
	const outputText = extractOutputText(payload);
	if (!outputText) throw new Error('OpenAI evaluation returned no text output');
	return { skipped: false as const, evaluation: llmEvaluationSchema.parse(JSON.parse(outputText)) };
}

function extractOutputText(payload: OpenAIResponsePayload) {
	if (payload.output_text) return payload.output_text;

	return payload.output
		?.flatMap((item) => item.content ?? [])
		.map((content) => content.text)
		.find((text) => text && text.trim().length > 0);
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
