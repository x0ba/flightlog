import {
	createProviderCredential,
	defaultTools,
	listProviderCredentials,
	modelCatalog
} from '$lib/server/provider-credentials';
import { requireUserId } from '$lib/server/auth';
import { ok, parseJson } from '$lib/server/http';
import { createProviderCredentialSchema } from '$lib/server/validation';

export async function GET(event) {
	const userId = requireUserId(event);
	const credentials = await listProviderCredentials(userId);
	return ok({ credentials, modelCatalog, tools: defaultTools });
}

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, createProviderCredentialSchema);
	const credential = await createProviderCredential(userId, input);
	return ok({ credential }, { status: 201 });
}
