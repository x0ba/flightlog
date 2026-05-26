import { requireUserId } from '$lib/server/auth';
import { notFound, ok, parseJson } from '$lib/server/http';
import { createRegressionRun, scheduleRegressionRun } from '$lib/server/regression/runs';
import { findRegressionSuiteForUser } from '$lib/server/regression/suites';
import { startRegressionRunSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const suite = await findRegressionSuiteForUser(event.params.id, userId);
	if (!suite) notFound('Regression suite not found');

	const input = await parseJson(event, startRegressionRunSchema);
	const regressionRun = await createRegressionRun(suite, userId, {
		githubOwner: suite.repositoryOwner,
		githubRepo: suite.repositoryName,
		githubSha: input.githubSha,
		githubRef: input.githubRef,
		pullRequestNumber: input.pullRequestNumber,
		metadata: input.metadata
	});

	if (input.executionMode === 'automated') {
		scheduleRegressionRun(regressionRun.id);
	}

	const pageUrl = new URL(`/regression/runs/${regressionRun.publicId}`, event.request.url).href;

	return ok(
		{
			run: {
				id: regressionRun.publicId,
				status: regressionRun.status,
				pageUrl
			}
		},
		{ status: 201 }
	);
}

export async function GET(event) {
	const userId = requireUserId(event);
	const suite = await findRegressionSuiteForUser(event.params.id, userId);
	if (!suite) notFound('Regression suite not found');

	const { listRegressionRunsForSuite } = await import('$lib/server/regression/runs');
	const runs = await listRegressionRunsForSuite(suite.id);

	return ok({
		runs: runs.map((run) => ({
			id: run.publicId,
			status: run.status,
			passed: run.passed,
			aggregateScore: run.aggregateScore,
			summary: run.summary,
			githubSha: run.githubSha,
			pullRequestNumber: run.pullRequestNumber,
			startedAt: run.startedAt,
			completedAt: run.completedAt
		}))
	});
}
