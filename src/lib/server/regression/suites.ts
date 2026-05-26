import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	githubInstallations,
	regressionCases,
	regressionRuns,
	regressionSuites
} from '$lib/server/db/schema';
import { publicId } from '$lib/server/public-id';
import {
	defaultEvaluationPolicy,
	parseConstraints,
	parsePolicy,
	type EvaluationPolicy
} from './policy';

export async function upsertGithubInstallation(input: {
	installationId: number;
	accountLogin: string;
	accountType: string;
	ownerUserId?: string;
	metadata?: unknown;
}) {
	const [upserted] = await db
		.insert(githubInstallations)
		.values({
			publicId: publicId('gh'),
			installationId: input.installationId,
			accountLogin: input.accountLogin,
			accountType: input.accountType,
			ownerUserId: input.ownerUserId,
			metadata: input.metadata
		})
		.onConflictDoUpdate({
			target: githubInstallations.installationId,
			set: {
				accountLogin: input.accountLogin,
				accountType: input.accountType,
				ownerUserId: sql`coalesce(excluded.owner_user_id, ${githubInstallations.ownerUserId})`,
				metadata: sql`coalesce(excluded.metadata, ${githubInstallations.metadata})`,
				updatedAt: new Date()
			}
		})
		.returning();

	return upserted;
}

export async function deleteGithubInstallation(installationId: number) {
	await db
		.delete(githubInstallations)
		.where(eq(githubInstallations.installationId, installationId));
}

export async function findGithubInstallation(installationId: number) {
	const [installation] = await db
		.select()
		.from(githubInstallations)
		.where(eq(githubInstallations.installationId, installationId))
		.limit(1);
	return installation;
}

export async function createRegressionSuite(
	ownerUserId: string,
	input: {
		name: string;
		description?: string;
		repositoryOwner: string;
		repositoryName: string;
		githubInstallationId?: number;
		enabled?: boolean;
		evaluationPolicy?: EvaluationPolicy;
	}
) {
	const [suite] = await db
		.insert(regressionSuites)
		.values({
			publicId: publicId('suite'),
			ownerUserId,
			name: input.name,
			description: input.description,
			repositoryOwner: input.repositoryOwner,
			repositoryName: input.repositoryName,
			githubInstallationId: input.githubInstallationId,
			enabled: input.enabled ?? true,
			evaluationPolicy: input.evaluationPolicy ?? defaultEvaluationPolicy
		})
		.returning();

	return suite;
}

export async function listRegressionSuites(ownerUserId: string) {
	const suites = await db
		.select()
		.from(regressionSuites)
		.where(eq(regressionSuites.ownerUserId, ownerUserId))
		.orderBy(desc(regressionSuites.updatedAt));

	if (!suites.length) return [];

	const suiteIds = suites.map((suite) => suite.id);

	const cases = await db
		.select({ suiteId: regressionCases.suiteId })
		.from(regressionCases)
		.where(inArray(regressionCases.suiteId, suiteIds));

	const caseCountBySuiteId = new Map<number, number>();
	for (const testCase of cases) {
		caseCountBySuiteId.set(testCase.suiteId, (caseCountBySuiteId.get(testCase.suiteId) ?? 0) + 1);
	}

	const runs = await db
		.select()
		.from(regressionRuns)
		.where(inArray(regressionRuns.suiteId, suiteIds))
		.orderBy(desc(regressionRuns.createdAt));

	const latestRunBySuiteId = new Map<number, (typeof runs)[number]>();
	for (const run of runs) {
		if (!latestRunBySuiteId.has(run.suiteId)) {
			latestRunBySuiteId.set(run.suiteId, run);
		}
	}

	return suites.map((suite) => {
		const latestRun = latestRunBySuiteId.get(suite.id);
		return {
			...suite,
			evaluationPolicy: parsePolicy(suite.evaluationPolicy),
			caseCount: caseCountBySuiteId.get(suite.id) ?? 0,
			latestRun: latestRun
				? {
						id: latestRun.publicId,
						status: latestRun.status,
						passed: latestRun.passed,
						aggregateScore: latestRun.aggregateScore,
						completedAt: latestRun.completedAt
					}
				: null
		};
	});
}

export async function findRegressionSuiteForUser(publicSuiteId: string, ownerUserId: string) {
	const [suite] = await db
		.select()
		.from(regressionSuites)
		.where(
			and(
				eq(regressionSuites.publicId, publicSuiteId),
				eq(regressionSuites.ownerUserId, ownerUserId)
			)
		)
		.limit(1);

	if (!suite) return undefined;

	return {
		...suite,
		evaluationPolicy: parsePolicy(suite.evaluationPolicy),
		cases: await listRegressionCases(suite.id)
	};
}

export async function findRegressionSuiteByRepository(
	repositoryOwner: string,
	repositoryName: string
) {
	const [suite] = await db
		.select()
		.from(regressionSuites)
		.where(
			and(
				eq(regressionSuites.repositoryOwner, repositoryOwner),
				eq(regressionSuites.repositoryName, repositoryName),
				eq(regressionSuites.enabled, true)
			)
		)
		.orderBy(desc(regressionSuites.updatedAt))
		.limit(1);

	if (!suite) return undefined;

	return {
		...suite,
		evaluationPolicy: parsePolicy(suite.evaluationPolicy),
		cases: await listRegressionCases(suite.id)
	};
}

export async function createRegressionCase(
	suiteId: number,
	input: {
		name: string;
		goal: string;
		constraints?: string[];
		expectedBehavior?: string;
		agentConfig?: unknown;
		minScore?: number;
		sortOrder?: number;
		enabled?: boolean;
	}
) {
	const [testCase] = await db
		.insert(regressionCases)
		.values({
			publicId: publicId('case'),
			suiteId,
			name: input.name,
			goal: input.goal,
			constraints: input.constraints ?? [],
			expectedBehavior: input.expectedBehavior,
			agentConfig: input.agentConfig,
			minScore: input.minScore ?? 70,
			sortOrder: input.sortOrder ?? 0,
			enabled: input.enabled ?? true
		})
		.returning();

	await db
		.update(regressionSuites)
		.set({ updatedAt: new Date() })
		.where(eq(regressionSuites.id, suiteId));

	return {
		...testCase,
		constraints: parseConstraints(testCase.constraints)
	};
}

export async function listRegressionCases(suiteId: number) {
	const cases = await db
		.select()
		.from(regressionCases)
		.where(eq(regressionCases.suiteId, suiteId))
		.orderBy(asc(regressionCases.sortOrder), asc(regressionCases.createdAt));

	return cases.map((testCase) => ({
		...testCase,
		constraints: parseConstraints(testCase.constraints)
	}));
}

export async function findRegressionCase(publicCaseId: string, suiteId: number) {
	const [testCase] = await db
		.select()
		.from(regressionCases)
		.where(and(eq(regressionCases.publicId, publicCaseId), eq(regressionCases.suiteId, suiteId)))
		.limit(1);

	if (!testCase) return undefined;

	return {
		...testCase,
		constraints: parseConstraints(testCase.constraints)
	};
}
