import { requireUserId } from '$lib/server/auth';
import { getRunDashboardMetricsForUser, listRuns } from '$lib/server/runs';
import { readOpenAIOAuthConfig, shouldUseDeviceAuth } from '$lib/server/openai-oauth';
import {
	defaultTools,
	listProviderCredentials,
	modelCatalog
} from '$lib/server/provider-credentials';
import { runStatusSchema } from '$lib/server/validation';

export async function load(event) {
	const userId = requireUserId(event);
	const { url } = event;
	const statusParam = url.searchParams.get('status');
	const status = statusParam ? runStatusSchema.parse(statusParam) : undefined;
	const q = url.searchParams.get('q') ?? undefined;
	const [result, metrics] = await Promise.all([
		listRuns({ ownerUserId: userId, status, q, limit: 50, offset: 0 }),
		getRunDashboardMetricsForUser(userId)
	]);
	const credentials = await listProviderCredentials(userId);
	const openaiOAuthConfig = readOpenAIOAuthConfig(url.origin);
	return {
		...result,
		metrics,
		filters: { status, q: q ?? '' },
		credentials,
		modelCatalog,
		tools: defaultTools,
		chatgptOAuthUseDeviceFlow: shouldUseDeviceAuth(openaiOAuthConfig)
	};
}
