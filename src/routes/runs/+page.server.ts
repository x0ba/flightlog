import { getRunDashboardMetrics, listRuns } from '$lib/server/runs';
import {
	defaultTools,
	listProviderCredentials,
	modelCatalog
} from '$lib/server/provider-credentials';
import { runStatusSchema } from '$lib/server/validation';

export async function load({ url }) {
	const statusParam = url.searchParams.get('status');
	const status = statusParam ? runStatusSchema.parse(statusParam) : undefined;
	const q = url.searchParams.get('q') ?? undefined;
	const [result, metrics] = await Promise.all([
		listRuns({ status, q, limit: 50, offset: 0 }),
		getRunDashboardMetrics()
	]);
	const credentials = await listProviderCredentials();
	return {
		...result,
		metrics,
		filters: { status, q: q ?? '' },
		credentials,
		modelCatalog,
		tools: defaultTools
	};
}
