import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import type { OpenAIComputerResponse, SafetyCheck } from './types';

const DEFAULT_AGENT_MODEL = 'computer-use-preview';

let client: OpenAI | undefined;

function openaiClient() {
	if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
	client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
	return client;
}

export function agentModel() {
	return env.OPENAI_AGENT_MODEL || DEFAULT_AGENT_MODEL;
}

const computerTool = {
	type: 'computer_use_preview',
	display_width: 1024,
	display_height: 768,
	environment: 'browser'
} as const;

export async function createInitialComputerResponse(prompt: string, screenshotDataUrl: string) {
	const response = await openaiClient().responses.create({
		model: agentModel(),
		tools: [computerTool],
		input: [
			{
				role: 'user',
				content: [
					{
						type: 'input_text',
						text: prompt
					},
					{
						type: 'input_image',
						image_url: screenshotDataUrl,
						detail: 'auto'
					}
				]
			}
		],
		reasoning: { summary: 'concise' },
		truncation: 'auto'
	});

	return response as OpenAIComputerResponse;
}

export async function continueComputerResponse(input: {
	previousResponseId: string;
	callId: string;
	screenshotDataUrl: string;
	currentUrl: string;
	acknowledgedSafetyChecks?: SafetyCheck[];
}) {
	const response = await openaiClient().responses.create({
		model: agentModel(),
		previous_response_id: input.previousResponseId,
		tools: [computerTool],
		input: [
			{
				type: 'computer_call_output',
				call_id: input.callId,
				acknowledged_safety_checks: input.acknowledgedSafetyChecks ?? [],
				output: {
					type: 'computer_screenshot',
					image_url: input.screenshotDataUrl
				}
			}
		],
		truncation: 'auto'
	});

	return response as OpenAIComputerResponse;
}

export function hasOpenAiKey() {
	return Boolean(env.OPENAI_API_KEY);
}
