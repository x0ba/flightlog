import { env } from '$env/dynamic/private';
import {
	assertChatGptSupportsBrowserRuns,
	postOpenAIResponses,
	resolveModelForTransport,
	type OpenAITransport
} from '$lib/server/openai-transport';
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
	openaiTransport?: OpenAITransport;
};

export function agentModel(modelOverride?: string, transport?: OpenAITransport) {
	const model = modelOverride || env.OPENAI_AGENT_MODEL || DEFAULT_AGENT_MODEL;
	return resolveModelForTransport(transport, model) ?? model;
}

export async function createInitialComputerResponse(
	prompt: string,
	screenshotDataUrl: string,
	credentials: ComputerUseCredentials
) {
	assertChatGptSupportsBrowserRuns(credentials.openaiTransport);
	const transport = credentials.openaiTransport ?? {
		kind: 'platform' as const,
		apiKey: credentials.apiKey
	};
	const response = await postOpenAIResponses({
		transport,
		body: {
			model: agentModel(credentials.model, credentials.openaiTransport),
			tools: [computerTool],
			input: [
				{
					role: 'user',
					content: [
						{ type: 'input_text', text: prompt },
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
		}
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
	assertChatGptSupportsBrowserRuns(input.credentials.openaiTransport);
	const transport = input.credentials.openaiTransport ?? {
		kind: 'platform' as const,
		apiKey: input.credentials.apiKey
	};
	const response = await postOpenAIResponses({
		transport,
		body: {
			model: agentModel(input.credentials.model, input.credentials.openaiTransport),
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
		}
	});

	return response as OpenAIComputerResponse;
}
