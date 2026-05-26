import {
	deleteProviderCredential,
	updateProviderCredential
} from '$lib/server/provider-credentials';
import { requireUserId } from '$lib/server/auth';
import { notFound, ok, parseJson } from '$lib/server/http';
import { updateProviderCredentialSchema } from '$lib/server/validation';

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
	return ok({ credential: deleted });
}
