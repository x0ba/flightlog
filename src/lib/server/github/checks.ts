import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { regressionCaseRuns, regressionRuns } from '$lib/server/db/schema';

function githubToken() {
	return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
}

function checkRunStatus(status: typeof regressionRuns.$inferSelect.status) {
	if (status === 'pending' || status === 'running') return 'in_progress';
	return 'completed';
}

function checkRunConclusion(status: typeof regressionRuns.$inferSelect.status) {
	if (status === 'success') return 'success';
	if (status === 'failed') return 'failure';
	if (status === 'cancelled') return 'cancelled';
	return undefined;
}

export async function updateRegressionCheckRun(regressionRunId: number) {
	const [regressionRun] = await db
		.select()
		.from(regressionRuns)
		.where(eq(regressionRuns.id, regressionRunId))
		.limit(1);

	if (!regressionRun?.githubOwner || !regressionRun.githubRepo || !regressionRun.githubCheckRunId) {
		return undefined;
	}

	const token = githubToken();
	if (!token) return undefined;

	const caseRuns = await db
		.select()
		.from(regressionCaseRuns)
		.where(eq(regressionCaseRuns.regressionRunId, regressionRun.id));
	const completed = caseRuns.filter(
		(caseRun) => caseRun.status !== 'pending' && caseRun.status !== 'running'
	);
	const failed = completed.filter((caseRun) => caseRun.status === 'failed');
	const conclusion = checkRunConclusion(regressionRun.status);
	const status = checkRunStatus(regressionRun.status);

	const response = await fetch(
		`https://api.github.com/repos/${regressionRun.githubOwner}/${regressionRun.githubRepo}/check-runs/${regressionRun.githubCheckRunId}`,
		{
			method: 'PATCH',
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				'X-GitHub-Api-Version': '2022-11-28'
			},
			body: JSON.stringify({
				status,
				conclusion,
				completed_at: status === 'completed' ? new Date().toISOString() : undefined,
				output: {
					title: regressionRun.summary ?? 'Regression suite running',
					summary: `${completed.length} of ${caseRuns.length} regression case(s) completed. ${failed.length} failed.`
				}
			})
		}
	);

	if (!response.ok) {
		throw new Error(`Failed to update GitHub check run: ${response.status}`);
	}

	return response.json();
}
