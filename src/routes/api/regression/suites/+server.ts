import { requireUserId } from '$lib/server/auth';
import { ok, parseJson } from '$lib/server/http';
import { createRegressionSuite, listRegressionSuites } from '$lib/server/regression/suites';
import { createRegressionSuiteSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, createRegressionSuiteSchema);
	const suite = await createRegressionSuite(userId, input);
	return ok(
		{
			suite: {
				id: suite.publicId,
				name: suite.name,
				repositoryOwner: suite.repositoryOwner,
				repositoryName: suite.repositoryName,
				enabled: suite.enabled
			}
		},
		{ status: 201 }
	);
}

export async function GET(event) {
	const userId = requireUserId(event);
	const suites = await listRegressionSuites(userId);
	return ok({
		suites: suites.map((suite) => ({
			id: suite.publicId,
			name: suite.name,
			description: suite.description,
			repositoryOwner: suite.repositoryOwner,
			repositoryName: suite.repositoryName,
			enabled: suite.enabled,
			caseCount: suite.caseCount,
			evaluationPolicy: suite.evaluationPolicy,
			latestRun: suite.latestRun
		}))
	});
}
