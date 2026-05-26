import { requireUserId } from '$lib/server/auth';
import { listRegressionRunsForSuite } from '$lib/server/regression/runs';
import { findRegressionSuiteForUser } from '$lib/server/regression/suites';
import { error } from '@sveltejs/kit';

export async function load(event) {
	const userId = requireUserId(event);
	const suite = await findRegressionSuiteForUser(event.params.id, userId);
	if (!suite) error(404, 'Regression suite not found');

	const runs = await listRegressionRunsForSuite(suite.id);
	return { suite, runs };
}
