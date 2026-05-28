import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	evaluationFindings,
	regressionCaseRuns,
	regressionCases,
	regressionRuns,
	regressionSuites
} from '$lib/server/db/schema';
import { evaluateRun } from '$lib/server/evaluation/service';
import { findRun } from '$lib/server/runs';
import { aggregateSuiteResult, evaluateCaseResult, parseConstraints, parsePolicy } from './policy';
import type { EvaluationPolicy } from './policy';

const activeRegressionRuns = new Set<number>();

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
	const { createAgentRun, maybeStartAgentRun } = await import('$lib/server/agent-runner/service');
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
