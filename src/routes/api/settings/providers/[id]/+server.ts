import {
	deleteProviderCredential,
	updateProviderCredential
} from '$lib/server/provider-credentials';
import { notFound, ok, parseJson } from '$lib/server/http';
import { updateProviderCredentialSchema } from '$lib/server/validation';

export async function PATCH(event) {
	const input = await parseJson(event, updateProviderCredentialSchema);
	const credential = await updateProviderCredential(event.params.id, input);
	if (!credential) notFound('Provider credential not found');
	return ok({ credential });
}

export async function DELETE({ params }) {
	const deleted = await deleteProviderCredential(params.id);
	if (!deleted) notFound('Provider credential not found');
	return ok({ credential: deleted });
}
