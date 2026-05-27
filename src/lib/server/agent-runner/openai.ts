import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import type { OpenAIComputerResponse, SafetyCheck } from './types';

const DEFAULT_AGENT_MODEL = 'computer-use-preview';

const computerTool = {
	type: 'computer_use_preview',
	display_width: 1024,
	display_height: 768,
	environment: 'browser'
} as const;

export type ComputerUseCredentials = {
	apiKey: string;
	model?: string;
};

export function agentModel(modelOverride?: string) {
	return modelOverride || env.OPENAI_AGENT_MODEL || DEFAULT_AGENT_MODEL;
}

function openaiClient(apiKey: string) {
	return new OpenAI({ apiKey });
}

export async function createInitialComputerResponse(
	prompt: string,
	screenshotDataUrl: string,
	credentials: ComputerUseCredentials
) {
	const response = await openaiClient(credentials.apiKey).responses.create({
		model: agentModel(credentials.model),
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
	credentials: ComputerUseCredentials;
	previousResponseId: string;
	callId: string;
	screenshotDataUrl: string;
	currentUrl: string;
	acknowledgedSafetyChecks?: SafetyCheck[];
}) {
	const response = await openaiClient(input.credentials.apiKey).responses.create({
		model: agentModel(input.credentials.model),
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
