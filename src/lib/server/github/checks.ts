import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { regressionCaseRuns, regressionCases, regressionRuns, runs } from '$lib/server/db/schema';
import { getInstallationOctokit, isGithubAppConfigured } from './app';

const CHECK_NAME = 'FlightLog Agent Regression';

function escapeMarkdownTableCell(value: string) {
	return value.replace(/\|/g, '\\|');
}

function dashboardUrl(path: string) {
	const base = publicEnv.PUBLIC_APP_URL ?? env.VERCEL_URL;
	if (!base) return path;
	const origin = base.startsWith('http') ? base : `https://${base}`;
	return `${origin.replace(/\/$/, '')}${path}`;
}

function buildCheckOutput(input: {
	summary: string;
	passed: boolean | null;
	aggregateScore: number | null;
	caseRuns: Array<{
		testCaseName: string;
		passed: boolean | null;
		score: number | null;
		failureReason: string | null;
		runPublicId: string | null;
	}>;
	regressionRunPublicId: string;
}) {
	const lines = [
		`## ${input.passed ? 'Passed' : input.passed === false ? 'Failed' : 'In progress'}`,
		input.summary,
		'',
		`| Case | Score | Result |`,
		`| --- | ---: | --- |`
	];

	for (const caseRun of input.caseRuns) {
		const result =
			caseRun.passed === null
				? 'running'
				: caseRun.passed
					? 'passed'
					: `failed${caseRun.failureReason ? `: ${caseRun.failureReason}` : ''}`;
		const safeName = escapeMarkdownTableCell(caseRun.testCaseName);
		const safeResult = escapeMarkdownTableCell(result);
		lines.push(
			`| ${safeName} | ${caseRun.score ?? '—'} | ${safeResult}${caseRun.runPublicId ? ` ([trace](${dashboardUrl(`/runs/${caseRun.runPublicId}`)}))` : ''} |`
		);
	}

	lines.push(
		'',
		`[Open suite run in FlightLog](${dashboardUrl(`/regression/runs/${input.regressionRunPublicId}`)})`
	);

	return {
		title: CHECK_NAME,
		summary: input.summary,
		text: lines.join('\n')
	};
}

export async function createRegressionCheckRun(input: {
	installationId: number;
	owner: string;
	repo: string;
	headSha: string;
	regressionRunPublicId: string;
}) {
	if (!isGithubAppConfigured()) return undefined;

	const octokit = await getInstallationOctokit(input.installationId);
	const response = await octokit.rest.checks.create({
		owner: input.owner,
		repo: input.repo,
		name: CHECK_NAME,
		head_sha: input.headSha,
		status: 'queued',
		output: {
			title: CHECK_NAME,
			summary: 'FlightLog regression suite is queued.',
			text: `Regression run \`${input.regressionRunPublicId}\` is queued.`
		},
		details_url: dashboardUrl(`/regression/runs/${input.regressionRunPublicId}`)
	});

	return BigInt(response.data.id);
}

export async function updateRegressionCheckRun(regressionRunId: number) {
	if (!isGithubAppConfigured()) return;

	const [regressionRun] = await db
		.select()
		.from(regressionRuns)
		.where(eq(regressionRuns.id, regressionRunId))
		.limit(1);
	if (!regressionRun?.githubCheckRunId || !regressionRun.githubOwner || !regressionRun.githubRepo) {
		return;
	}

	const metadata = regressionRun.metadata;
	const installationId =
		metadata &&
		typeof metadata === 'object' &&
		!Array.isArray(metadata) &&
		typeof (metadata as Record<string, unknown>).installationId === 'number'
			? ((metadata as Record<string, unknown>).installationId as number)
			: undefined;
	if (!installationId) return;

	const caseRuns = await db
		.select({
			caseRun: regressionCaseRuns,
			testCase: regressionCases,
			run: runs
		})
		.from(regressionCaseRuns)
		.innerJoin(regressionCases, eq(regressionCaseRuns.caseId, regressionCases.id))
		.leftJoin(runs, eq(regressionCaseRuns.runId, runs.id))
		.where(eq(regressionCaseRuns.regressionRunId, regressionRun.id));

	const output = buildCheckOutput({
		summary: regressionRun.summary ?? 'Regression suite is running.',
		passed: regressionRun.passed,
		aggregateScore: regressionRun.aggregateScore,
		regressionRunPublicId: regressionRun.publicId,
		caseRuns: caseRuns.map(({ caseRun, testCase, run }) => ({
			testCaseName: testCase.name,
			passed: caseRun.passed,
			score: caseRun.score,
			failureReason: caseRun.failureReason,
			runPublicId: run?.publicId ?? null
		}))
	});

	const octokit = await getInstallationOctokit(installationId);
	const isComplete =
		regressionRun.status === 'success' ||
		regressionRun.status === 'failed' ||
		regressionRun.status === 'cancelled';
	const conclusion = isComplete
		? regressionRun.status === 'cancelled'
			? 'cancelled'
			: regressionRun.passed === true
				? 'success'
				: regressionRun.passed === false
					? 'failure'
					: 'neutral'
		: undefined;

	await octokit.rest.checks.update({
		owner: regressionRun.githubOwner,
		repo: regressionRun.githubRepo,
		check_run_id: Number(regressionRun.githubCheckRunId),
		status: isComplete ? 'completed' : 'in_progress',
		conclusion,
		completed_at: isComplete ? new Date().toISOString() : undefined,
		output,
		details_url: dashboardUrl(`/regression/runs/${regressionRun.publicId}`)
	});
}

export { CHECK_NAME };
