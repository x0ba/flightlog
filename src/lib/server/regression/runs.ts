import { and, desc, eq } from 'drizzle-orm';
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

const activeRegressionRuns = new Set<number>();

type GithubCheckRunId = bigint | number | string;

type AgentConfig = {
	runMode?: 'browser' | 'tool_agent';
	provider?: 'openai' | 'anthropic';
	framework?: 'native' | 'ai-sdk' | 'langchain' | 'custom';
	model?: string;
	credentialId?: string;
	browserbaseCredentialId?: string;
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
	suitePublicId: string,
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
	const suite = await findRegressionSuiteForUser(suitePublicId, ownerUserId);
	if (!suite) return undefined;

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
	forceNewRun?: boolean;
}) {
	const suite = await findRegressionSuiteByRepository(input.repositoryOwner, input.repositoryName);
	if (!suite) return undefined;

	if (!input.forceNewRun) {
		const [existingRun] = await db
			.select()
			.from(regressionRuns)
			.where(
				and(
					eq(regressionRuns.suiteId, suite.id),
					eq(regressionRuns.githubOwner, input.repositoryOwner),
					eq(regressionRuns.githubRepo, input.repositoryName),
					eq(regressionRuns.githubSha, input.githubSha),
					input.pullRequestNumber === undefined
						? undefined
						: eq(regressionRuns.pullRequestNumber, input.pullRequestNumber)
				)
			)
			.orderBy(desc(regressionRuns.createdAt))
			.limit(1);
		if (existingRun) return { regressionRun: existingRun, suite, isNewRun: false };
	}

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

	return { regressionRun, suite, isNewRun: true };
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
		browserbaseCredentialId: agentConfig.browserbaseCredentialId,
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

export async function completeRegressionCaseRun(input: {
	regressionRunPublicId: string;
	casePublicId: string;
	ownerUserId: string;
	runPublicId: string;
	constraints?: string[];
}) {
	const detail = await findRegressionRunForUser(input.regressionRunPublicId, input.ownerUserId);
	if (!detail) return undefined;

	if (
		detail.regressionRun.status === 'cancelled' ||
		detail.regressionRun.status === 'success' ||
		detail.regressionRun.status === 'failed'
	) {
		return undefined;
	}

	const caseRun = detail.caseRuns.find((row) => row.testCase.publicId === input.casePublicId);
	if (!caseRun) return undefined;
	if (caseRun.status === 'success' || caseRun.status === 'failed' || caseRun.status === 'skipped') {
		return undefined;
	}

	const run = await findRun(input.runPublicId);
	if (!run || run.ownerUserId !== input.ownerUserId) return undefined;

	const constraints = input.constraints ?? parseConstraints(caseRun.testCase.constraints);

	const evaluation = await evaluateRun(run.publicId, input.ownerUserId, constraints);
	if (!evaluation) return undefined;

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

	const updatedCaseRuns = await db
		.select()
		.from(regressionCaseRuns)
		.where(eq(regressionCaseRuns.regressionRunId, detail.regressionRun.id));

	const allDone = updatedCaseRuns.every(
		(row) => row.status !== 'pending' && row.status !== 'running'
	);
	if (allDone) {
		const aggregate = aggregateSuiteResult(updatedCaseRuns);
		await db
			.update(regressionRuns)
			.set({
				status: aggregate.passed ? 'success' : 'failed',
				passed: aggregate.passed,
				aggregateScore: aggregate.aggregateScore,
				summary: aggregate.summary,
				completedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(regressionRuns.id, detail.regressionRun.id));
	}

	const { updateRegressionCheckRun } = await import('$lib/server/github/checks');
	await updateRegressionCheckRun(detail.regressionRun.id).catch(() => undefined);

	return { caseResult, evaluation };
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
