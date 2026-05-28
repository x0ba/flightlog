import {
	createProviderCredential,
	defaultTools,
	listProviderCredentials,
	modelCatalog
} from '$lib/server/provider-credentials';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson } from '$lib/server/http';
import { createProviderCredentialSchema } from '$lib/server/validation';
import { getPostHogClient } from '$lib/server/posthog';

export async function GET(event) {
	const userId = requireUserId(event);
	const credentials = await listProviderCredentials(userId);
	return ok({ credentials, modelCatalog, tools: defaultTools });
}

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, createProviderCredentialSchema);
	const credential = await createProviderCredential(userId, input);

	const posthog = getPostHogClient();
	posthog.capture({
		distinctId: event.request.headers.get('x-posthog-distinct-id') || userId,
		event: 'provider_key_saved',
		properties: {
			provider: input.provider,
			auth_type: 'authType' in input ? input.authType : 'api_key',
			$session_id: event.request.headers.get('x-posthog-session-id') || undefined
		}
	});

	return ok({ credential }, { status: 201 });
}
