import { env } from '$env/dynamic/private';
import type { RunMetadata } from '$lib/server/agent-runner/types';
import { getProviderApiKey } from '$lib/server/provider-credentials';
import type { OpenAITransport } from '$lib/server/openai-transport';

function readAgentRequest(metadata: unknown) {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
	return (metadata as RunMetadata).agentRequest;
}

export async function resolveEvaluationTransport(input: {
	ownerUserId: string | null | undefined;
	runMetadata: unknown;
	credentialId?: string;
}): Promise<OpenAITransport | undefined> {
	const agentRequest = readAgentRequest(input.runMetadata);
	const credentialPublicId = input.credentialId ?? agentRequest?.credentialId;

	if (input.ownerUserId && credentialPublicId) {
		const credential = await getProviderApiKey(input.ownerUserId, credentialPublicId, 'openai');
		if (credential?.openaiTransport) return credential.openaiTransport;
		if (credential?.apiKey) return { kind: 'platform', apiKey: credential.apiKey };
	}

	const envKey = env.OPENAI_API_KEY?.trim();
	if (envKey) return { kind: 'platform', apiKey: envKey };

	return undefined;
}
