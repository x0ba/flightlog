import {
	deleteProviderCredential,
	updateProviderCredential
} from '$lib/server/provider-credentials';
import { requireUserId } from '$lib/server/auth';
import { notFound, ok, parseJson } from '$lib/server/http';
import { updateProviderCredentialSchema } from '$lib/server/validation';
import { getPostHogClient } from '$lib/server/posthog';

export async function PATCH(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, updateProviderCredentialSchema);
	const credential = await updateProviderCredential(userId, event.params.id, input);
	if (!credential) notFound('Provider credential not found');
	return ok({ credential });
}

export async function DELETE(event) {
	const userId = requireUserId(event);
	const deleted = await deleteProviderCredential(userId, event.params.id);
	if (!deleted) notFound('Provider credential not found');

	const posthog = getPostHogClient();
	posthog.capture({
		distinctId: event.request.headers.get('x-posthog-distinct-id') || userId,
		event: 'provider_key_deleted',
		properties: {
			credential_id: event.params.id,
			$session_id: event.request.headers.get('x-posthog-session-id') || undefined
		}
	});

	return ok({ credential: deleted });
}
