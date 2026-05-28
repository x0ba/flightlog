import { requireUserId } from '$lib/server/auth';
import { notFound, ok, parseJson } from '$lib/server/http';
import { createRegressionCase, findRegressionSuiteForUser } from '$lib/server/regression/suites';
import { createRegressionCaseSchema } from '$lib/server/validation';

/** @type {import('@sveltejs/adapter-vercel').Config} */
export const config = {
	maxDuration: 300
};

export async function POST(event) {
	const userId = requireUserId(event);
	const suite = await findRegressionSuiteForUser(event.params.id, userId);
	if (!suite) notFound('Regression suite not found');

	const input = await parseJson(event, createRegressionCaseSchema);
	const testCase = await createRegressionCase(suite.id, input);

	return ok(
		{
			case: {
				id: testCase.publicId,
				name: testCase.name,
				goal: testCase.goal,
				minScore: testCase.minScore,
				enabled: testCase.enabled
			}
		},
		{ status: 201 }
	);
}

export async function GET(event) {
	const userId = requireUserId(event);
	const suite = await findRegressionSuiteForUser(event.params.id, userId);
	if (!suite) notFound('Regression suite not found');

	return ok({
		suite: {
			id: suite.publicId,
			name: suite.name,
			description: suite.description,
			repositoryOwner: suite.repositoryOwner,
			repositoryName: suite.repositoryName,
			enabled: suite.enabled,
			evaluationPolicy: suite.evaluationPolicy,
			cases: suite.cases.map((testCase) => ({
				id: testCase.publicId,
				name: testCase.name,
				goal: testCase.goal,
				constraints: testCase.constraints,
				expectedBehavior: testCase.expectedBehavior,
				agentConfig: testCase.agentConfig,
				minScore: testCase.minScore,
				sortOrder: testCase.sortOrder,
				enabled: testCase.enabled
			}))
		}
	});
}
