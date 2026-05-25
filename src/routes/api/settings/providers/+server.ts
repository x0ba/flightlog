import {
	createProviderCredential,
	defaultTools,
	listProviderCredentials,
	modelCatalog
} from '$lib/server/provider-credentials';
import { ok, parseJson } from '$lib/server/http';
import { createProviderCredentialSchema } from '$lib/server/validation';

export async function GET() {
	const credentials = await listProviderCredentials();
	return ok({ credentials, modelCatalog, tools: defaultTools });
}

export async function POST(event) {
	const input = await parseJson(event, createProviderCredentialSchema);
	const credential = await createProviderCredential(input);
	return ok({ credential }, { status: 201 });
}
