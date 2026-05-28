import { requireUserId } from '$lib/server/auth';
import { listRegressionSuites } from '$lib/server/regression/suites';

export async function load(event) {
	const userId = requireUserId(event);
	const suites = await listRegressionSuites(userId);
	return { suites };
}
