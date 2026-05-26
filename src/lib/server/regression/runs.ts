import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	evaluationFindings,
	evaluations,
	regressionCaseRuns,
	regressionCases,
	regressionRuns,
	regressionSuites,
	runs
} from '$lib/server/db/schema';
import { createAgentRun, maybeStartAgentRun } from '$lib/server/agent-runner/service';
import { evaluateRun } from '$lib/server/evaluation/service';
import { findRun } from '$lib/server/runs';
import { publicId } from '$lib/server/public-id';
import { aggregateSuiteResult, evaluateCaseResult, parseConstraints, parsePolicy } from './policy';
import { findRegressionSuiteByRepository, findRegressionSuiteForUser } from './suites';
import type { EvaluationPolicy } from './policy';

type RegressionSuiteForUser = NonNullable<Awaited<ReturnType<typeof findRegressionSuiteForUser>>>;

const activeRegressionRuns = new Set<number>();

type GithubCheckRunId = bigint | number | string;

type AgentConfig = {
	runMode?: 'browser' | 'tool_agent';
	provider?: 'openai' | 'anthropic';
	framework?: 'native' | 'ai-sdk' | 'langchain' | 'custom';
	model?: string;
	credentialId?: string;
	tools?: string[];
	approvalPolicy?: 'risk_based' | 'always' | 'never';
	maxSteps?: number;
	temperature?: number;
	systemPrompt?: string;
};

function parseAgentConfig(value: unknown): AgentConfig {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as AgentConfig;
}

function parseGithubCheckRunId(value: GithubCheckRunId | undefined) {
	return value === undefined ? undefined : BigInt(value);
}

async function waitForRunCompletion(publicRunId: string, timeoutMs = 600_000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const run = await findRun(publicRunId);
		if (!run) throw new Error('Run not found');
		if (run.status === 'success' || run.status === 'failed' || run.status === 'cancelled') {
			return run;
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
	throw new Error('Agent run timed out');
}

export async function createRegressionRun(
	suite: RegressionSuiteForUser,
	ownerUserId: string,
	input: {
		githubOwner?: string;
		githubRepo?: string;
		githubSha?: string;
		githubRef?: string;
		pullRequestNumber?: number;
		githubCheckRunId?: GithubCheckRunId;
		metadata?: unknown;
	}
) {
	const enabledCases = suite.cases.filter((testCase) => testCase.enabled);
	const [regressionRun] = await db
		.insert(regressionRuns)
		.values({
			publicId: publicId('rgr'),
			suiteId: suite.id,
			ownerUserId,
			status: enabledCases.length ? 'pending' : 'failed',
			githubOwner: input.githubOwner ?? suite.repositoryOwner,
			githubRepo: input.githubRepo ?? suite.repositoryName,
			githubSha: input.githubSha,
			githubRef: input.githubRef,
			pullRequestNumber: input.pullRequestNumber,
			githubCheckRunId: parseGithubCheckRunId(input.githubCheckRunId),
			metadata: input.metadata,
			passed: enabledCases.length ? null : false,
			summary: enabledCases.length ? null : 'Regression suite has no enabled cases.',
			startedAt: enabledCases.length ? new Date() : null,
			completedAt: enabledCases.length ? null : new Date()
		})
		.returning();

	if (enabledCases.length) {
		await db.insert(regressionCaseRuns).values(
			enabledCases.map((testCase) => ({
				publicId: publicId('cgr'),
				regressionRunId: regressionRun.id,
				caseId: testCase.id,
				status: 'pending' as const
			}))
		);
	}

	return regressionRun;
}

export async function createRegressionRunForRepository(input: {
	repositoryOwner: string;
	repositoryName: string;
	githubSha: string;
	githubRef?: string;
	pullRequestNumber?: number;
	githubCheckRunId?: GithubCheckRunId;
	ownerUserId?: string;
	metadata?: unknown;
}) {
	const suite = await findRegressionSuiteByRepository(input.repositoryOwner, input.repositoryName);
	if (!suite) return undefined;

	const enabledCases = suite.cases.filter((testCase) => testCase.enabled);
	const [regressionRun] = await db
		.insert(regressionRuns)
		.values({
			publicId: publicId('rgr'),
			suiteId: suite.id,
			ownerUserId: suite.ownerUserId,
			status: enabledCases.length ? 'pending' : 'failed',
			githubOwner: input.repositoryOwner,
			githubRepo: input.repositoryName,
			githubSha: input.githubSha,
			githubRef: input.githubRef,
			pullRequestNumber: input.pullRequestNumber,
			githubCheckRunId: parseGithubCheckRunId(input.githubCheckRunId),
			metadata: input.metadata,
			startedAt: enabledCases.length ? new Date() : null,
			passed: enabledCases.length ? null : false,
			summary: enabledCases.length ? null : 'Regression suite has no enabled cases.',
			completedAt: enabledCases.length ? null : new Date()
		})
		.returning();

	if (enabledCases.length) {
		await db.insert(regressionCaseRuns).values(
			enabledCases.map((testCase) => ({
				publicId: publicId('cgr'),
				regressionRunId: regressionRun.id,
				caseId: testCase.id,
				status: 'pending' as const
			}))
		);
	}

	return { regressionRun, suite };
}

export function scheduleRegressionRun(regressionRunId: number) {
	if (activeRegressionRuns.has(regressionRunId)) return false;
	activeRegressionRuns.add(regressionRunId);
	void executeRegressionRun(regressionRunId).finally(() =>
		activeRegressionRuns.delete(regressionRunId)
	);
	return true;
}

export async function executeRegressionRun(regressionRunId: number) {
	const [regressionRun] = await db
		.select()
		.from(regressionRuns)
		.where(eq(regressionRuns.id, regressionRunId))
		.limit(1);
	if (
		!regressionRun ||
		regressionRun.status === 'success' ||
		regressionRun.status === 'failed' ||
		regressionRun.status === 'cancelled'
	) {
		return regressionRun;
	}

	const [suite] = await db
		.select()
		.from(regressionSuites)
		.where(eq(regressionSuites.id, regressionRun.suiteId))
		.limit(1);
	if (!suite) return regressionRun;

	const policy = parsePolicy(suite.evaluationPolicy);
	const caseRuns = await db
		.select({
			caseRun: regressionCaseRuns,
			testCase: regressionCases
		})
		.from(regressionCaseRuns)
		.innerJoin(regressionCases, eq(regressionCaseRuns.caseId, regressionCases.id))
		.where(eq(regressionCaseRuns.regressionRunId, regressionRun.id))
		.orderBy(regressionCases.sortOrder, regressionCases.createdAt);

	await db
		.update(regressionRuns)
		.set({
			status: 'running',
			startedAt: regressionRun.startedAt ?? new Date(),
			updatedAt: new Date()
		})
		.where(eq(regressionRuns.id, regressionRun.id));

	const { updateRegressionCheckRun } = await import('$lib/server/github/checks');

	for (const { caseRun, testCase } of caseRuns) {
		if (caseRun.status !== 'pending') continue;

		await db
			.update(regressionCaseRuns)
			.set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
			.where(eq(regressionCaseRuns.id, caseRun.id));

		try {
			const result = await executeRegressionCase({
				regressionRun,
				suite,
				testCase,
				policy,
				ownerUserId: regressionRun.ownerUserId ?? suite.ownerUserId
			});

			await db
				.update(regressionCaseRuns)
				.set({
					status: result.passed ? 'success' : 'failed',
					runId: result.runId,
					evaluationId: result.evaluationId,
					score: result.score,
					passed: result.passed,
					failureReason: result.failureReason,
					completedAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(regressionCaseRuns.id, caseRun.id));
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : 'Unknown regression case error';
			await db
				.update(regressionCaseRuns)
				.set({
					status: 'failed',
					passed: false,
					failureReason: message,
					completedAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(regressionCaseRuns.id, caseRun.id));
		}

		await updateRegressionCheckRun(regressionRun.id).catch(() => undefined);
	}

	const updatedCaseRuns = await db
		.select()
		.from(regressionCaseRuns)
		.where(eq(regressionCaseRuns.regressionRunId, regressionRun.id));

	const aggregate = aggregateSuiteResult(updatedCaseRuns);
	const [completedRun] = await db
		.update(regressionRuns)
		.set({
			status: aggregate.passed ? 'success' : 'failed',
			passed: aggregate.passed,
			aggregateScore: aggregate.aggregateScore,
			summary: aggregate.summary,
			completedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(regressionRuns.id, regressionRun.id))
		.returning();

	await updateRegressionCheckRun(regressionRun.id).catch(() => undefined);
	return completedRun;
}

async function executeRegressionCase(input: {
	regressionRun: typeof regressionRuns.$inferSelect;
	suite: typeof regressionSuites.$inferSelect;
	testCase: typeof regressionCases.$inferSelect;
	policy: EvaluationPolicy;
	ownerUserId: string;
}) {
	const constraints = parseConstraints(input.testCase.constraints);
	const agentConfig = parseAgentConfig(input.testCase.agentConfig);

	const run = await createAgentRun({
		ownerUserId: input.ownerUserId,
		prompt: input.testCase.goal,
		name: input.testCase.name,
		constraints,
		runMode: agentConfig.runMode ?? 'tool_agent',
		provider: agentConfig.provider ?? 'openai',
		framework: agentConfig.framework ?? 'native',
		model: agentConfig.model,
		credentialId: agentConfig.credentialId,
		tools: agentConfig.tools,
		approvalPolicy: agentConfig.approvalPolicy ?? 'risk_based',
		maxSteps: agentConfig.maxSteps,
		temperature: agentConfig.temperature,
		systemPrompt: input.testCase.expectedBehavior ?? agentConfig.systemPrompt
	});

	await maybeStartAgentRun(run.publicId);
	const completedRun = await waitForRunCompletion(run.publicId);
	const evaluation = await evaluateRun(run.publicId, input.ownerUserId, constraints);
	if (!evaluation) throw new Error('Evaluation failed to complete.');

	const findings = await db
		.select()
		.from(evaluationFindings)
		.where(eq(evaluationFindings.evaluationId, evaluation.id));

	const caseResult = evaluateCaseResult(
		{
			score: evaluation.score,
			violatedConstraints: evaluation.violatedConstraints,
			goalCompleted: evaluation.goalCompleted,
			findings,
			caseMinScore: input.testCase.minScore
		},
		input.policy
	);

	return {
		runId: completedRun.id,
		evaluationId: evaluation.id,
		score: evaluation.score,
		passed: caseResult.passed,
		failureReason: caseResult.reason
	};
}

async function finalizeRegressionRunIfComplete(regressionRunId: number) {
	await db.execute(sql`
		WITH case_stats AS (
			SELECT
				COUNT(*) FILTER (WHERE passed IS NOT NULL) AS completed_count,
				BOOL_AND(passed) FILTER (WHERE passed IS NOT NULL) AS all_passed,
				ROUND(AVG(score) FILTER (WHERE score IS NOT NULL))::int AS avg_score,
				COUNT(*) FILTER (WHERE passed IS NOT NULL AND passed = false) AS failed_count
			FROM regression_case_runs
			WHERE regression_run_id = ${regressionRunId}
		)
		UPDATE regression_runs AS r
		SET
			status = CASE
				WHEN cs.completed_count = 0 THEN 'failed'::regression_run_status
				WHEN cs.all_passed THEN 'success'::regression_run_status
				ELSE 'failed'::regression_run_status
			END,
			passed = CASE
				WHEN cs.completed_count = 0 THEN false
				ELSE COALESCE(cs.all_passed, false)
			END,
			aggregate_score = cs.avg_score,
			summary = CASE
				WHEN cs.completed_count = 0 THEN 'No regression cases completed.'
				WHEN cs.all_passed THEN
					'All ' || cs.completed_count::text || ' regression case(s) passed.'
				ELSE
					cs.failed_count::text || ' of ' || cs.completed_count::text ||
					' regression case(s) failed.'
			END,
			completed_at = NOW(),
			updated_at = NOW()
		FROM case_stats AS cs
		WHERE r.id = ${regressionRunId}
			AND r.status IN ('pending', 'running')
			AND NOT EXISTS (
				SELECT 1
				FROM regression_case_runs AS c
				WHERE c.regression_run_id = ${regressionRunId}
					AND c.status IN ('pending', 'running')
			)
	`);
}

export async function completeRegressionCaseRun(input: {
	regressionRunPublicId: string;
	casePublicId: string;
	ownerUserId: string;
	runPublicId: string;
	constraints?: string[];
}) {
	const detail = await findRegressionRunForUser(input.regressionRunPublicId, input.ownerUserId);
	if (!detail) return { status: 'not_found' as const };

	if (
		detail.regressionRun.status === 'cancelled' ||
		detail.regressionRun.status === 'success' ||
		detail.regressionRun.status === 'failed'
	) {
		return { status: 'not_found' as const };
	}

	const caseRun = detail.caseRuns.find((row) => row.testCase.publicId === input.casePublicId);
	if (!caseRun) return { status: 'not_found' as const };

	if (caseRun.status === 'running') return { status: 'in_progress' as const };

	if (caseRun.status === 'success' || caseRun.status === 'failed' || caseRun.status === 'skipped') {
		if (!caseRun.evaluationId) return { status: 'not_found' as const };

		const [existingEvaluation] = await db
			.select()
			.from(evaluations)
			.where(eq(evaluations.id, caseRun.evaluationId))
			.limit(1);
		if (!existingEvaluation) return { status: 'not_found' as const };

		const { updateRegressionCheckRun } = await import('$lib/server/github/checks');
		await updateRegressionCheckRun(detail.regressionRun.id).catch(() => undefined);

		return {
			status: 'completed' as const,
			caseResult: {
				passed: caseRun.passed ?? false,
				reason: caseRun.failureReason ?? undefined
			},
			evaluation: existingEvaluation
		};
	}

	const run = await findRun(input.runPublicId);
	if (!run || run.ownerUserId !== input.ownerUserId) return { status: 'not_found' as const };

	if (detail.regressionRun.status === 'pending') {
		const updated = await db
			.update(regressionRuns)
			.set({
				status: 'running',
				startedAt: detail.regressionRun.startedAt ?? new Date(),
				updatedAt: new Date()
			})
			.where(
				and(eq(regressionRuns.id, detail.regressionRun.id), eq(regressionRuns.status, 'pending'))
			);

		if (updated.rowCount) {
			const { updateRegressionCheckRun } = await import('$lib/server/github/checks');
			await updateRegressionCheckRun(detail.regressionRun.id).catch(() => undefined);
		}
	}

	const claimedCaseRun = await db
		.update(regressionCaseRuns)
		.set({
			status: 'running',
			startedAt: caseRun.startedAt ?? new Date(),
			updatedAt: new Date()
		})
		.where(and(eq(regressionCaseRuns.id, caseRun.id), eq(regressionCaseRuns.status, 'pending')));

	if (!claimedCaseRun.rowCount) return { status: 'in_progress' as const };

	const constraints = input.constraints ?? parseConstraints(caseRun.testCase.constraints);

	const evaluation = await evaluateRun(run.publicId, input.ownerUserId, constraints);
	if (!evaluation) return { status: 'not_found' as const };

	const findings = await db
		.select()
		.from(evaluationFindings)
		.where(eq(evaluationFindings.evaluationId, evaluation.id));

	const caseResult = evaluateCaseResult(
		{
			score: evaluation.score,
			violatedConstraints: evaluation.violatedConstraints,
			goalCompleted: evaluation.goalCompleted,
			findings,
			caseMinScore: caseRun.testCase.minScore
		},
		detail.suite.evaluationPolicy
	);

	await db
		.update(regressionCaseRuns)
		.set({
			status: caseResult.passed ? 'success' : 'failed',
			runId: run.id,
			evaluationId: evaluation.id,
			score: evaluation.score,
			passed: caseResult.passed,
			failureReason: caseResult.reason,
			completedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(regressionCaseRuns.id, caseRun.id));

	await finalizeRegressionRunIfComplete(detail.regressionRun.id);

	const { updateRegressionCheckRun } = await import('$lib/server/github/checks');
	await updateRegressionCheckRun(detail.regressionRun.id).catch(() => undefined);

	return {
		status: 'completed' as const,
		caseResult,
		evaluation
	};
}

export async function findRegressionRunForUser(publicRunId: string, ownerUserId: string) {
	const [regressionRun] = await db
		.select()
		.from(regressionRuns)
		.where(
			and(eq(regressionRuns.publicId, publicRunId), eq(regressionRuns.ownerUserId, ownerUserId))
		)
		.limit(1);
	if (!regressionRun) return undefined;

	const [suite] = await db
		.select()
		.from(regressionSuites)
		.where(eq(regressionSuites.id, regressionRun.suiteId))
		.limit(1);
	if (!suite) return undefined;

	const caseRuns = await db
		.select({
			caseRun: regressionCaseRuns,
			testCase: regressionCases,
			run: runs,
			evaluation: evaluations
		})
		.from(regressionCaseRuns)
		.innerJoin(regressionCases, eq(regressionCaseRuns.caseId, regressionCases.id))
		.leftJoin(runs, eq(regressionCaseRuns.runId, runs.id))
		.leftJoin(evaluations, eq(regressionCaseRuns.evaluationId, evaluations.id))
		.where(eq(regressionCaseRuns.regressionRunId, regressionRun.id))
		.orderBy(regressionCases.sortOrder, regressionCases.createdAt);

	return {
		regressionRun,
		suite: {
			...suite,
			evaluationPolicy: parsePolicy(suite.evaluationPolicy)
		},
		caseRuns: caseRuns.map(({ caseRun, testCase, run, evaluation }) => ({
			...caseRun,
			testCase: {
				...testCase,
				constraints: parseConstraints(testCase.constraints)
			},
			runPublicId: run?.publicId ?? null,
			evaluation: evaluation
				? {
						id: evaluation.publicId,
						score: evaluation.score,
						summary: evaluation.summary,
						status: evaluation.status
					}
				: null
		}))
	};
}

export async function listRegressionRunsForSuite(suiteId: number, limit = 20) {
	return db
		.select()
		.from(regressionRuns)
		.where(eq(regressionRuns.suiteId, suiteId))
		.orderBy(desc(regressionRuns.createdAt))
		.limit(limit);
}
