import { requireUserId } from '$lib/server/auth';
import { ok, parseJson } from '$lib/server/http';
import { createRegressionSuite, listRegressionSuites } from '$lib/server/regression/suites';
import { createRegressionSuiteSchema } from '$lib/server/validation';
import { getPostHogClient } from '$lib/server/posthog';

/** @type {import('@sveltejs/adapter-vercel').Config} */
export const config = {
	maxDuration: 300
};

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, createRegressionSuiteSchema);
	const suite = await createRegressionSuite(userId, input);

	const posthog = getPostHogClient();
	posthog.capture({
		distinctId: event.request.headers.get('x-posthog-distinct-id') || userId,
		event: 'regression_suite_created',
		properties: {
			suite_id: suite.publicId,
			repository: `${suite.repositoryOwner}/${suite.repositoryName}`,
			$session_id: event.request.headers.get('x-posthog-session-id') || undefined
		}
	});

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
