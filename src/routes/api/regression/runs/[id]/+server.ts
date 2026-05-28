import { requireUserId } from '$lib/server/auth';
import { notFound, ok } from '$lib/server/http';
import { findRegressionRunForUser } from '$lib/server/regression/runs';

/** @type {import('@sveltejs/adapter-vercel').Config} */
export const config = {
	maxDuration: 300
};

export async function GET(event) {
	const userId = requireUserId(event);
	const detail = await findRegressionRunForUser(event.params.id, userId);
	if (!detail) notFound('Regression run not found');

	return ok({
		run: {
			id: detail.regressionRun.publicId,
			status: detail.regressionRun.status,
			passed: detail.regressionRun.passed,
			aggregateScore: detail.regressionRun.aggregateScore,
			summary: detail.regressionRun.summary,
			githubOwner: detail.regressionRun.githubOwner,
			githubRepo: detail.regressionRun.githubRepo,
			githubSha: detail.regressionRun.githubSha,
			githubRef: detail.regressionRun.githubRef,
			pullRequestNumber: detail.regressionRun.pullRequestNumber,
			githubCheckRunId: detail.regressionRun.githubCheckRunId?.toString() ?? null,
			startedAt: detail.regressionRun.startedAt,
			completedAt: detail.regressionRun.completedAt
		},
		suite: {
			id: detail.suite.publicId,
			name: detail.suite.name,
			repositoryOwner: detail.suite.repositoryOwner,
			repositoryName: detail.suite.repositoryName,
			evaluationPolicy: detail.suite.evaluationPolicy
		},
		caseRuns: detail.caseRuns.map((caseRun) => ({
			id: caseRun.publicId,
			status: caseRun.status,
			passed: caseRun.passed,
			score: caseRun.score,
			failureReason: caseRun.failureReason,
			runPublicId: caseRun.runPublicId,
			evaluation: caseRun.evaluation,
			case: {
				id: caseRun.testCase.publicId,
				name: caseRun.testCase.name,
				goal: caseRun.testCase.goal,
				minScore: caseRun.testCase.minScore
			}
		}))
	});
}
