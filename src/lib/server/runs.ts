import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	evaluationFindings,
	evaluations,
	events,
	runs,
	type runStatusEnum
} from '$lib/server/db/schema';
import { publicId } from '$lib/server/public-id';

type RunStatus = (typeof runStatusEnum.enumValues)[number];

export async function createRun(input: {
	ownerUserId: string;
	schemaVersion?: string;
	name?: string;
	goal: string;
	agentName?: string;
	agentVersion?: string;
	environment?: string;
	metadata?: unknown;
}) {
	const [run] = await db
		.insert(runs)
		.values({
			publicId: publicId('run'),
			ownerUserId: input.ownerUserId,
			schemaVersion: input.schemaVersion,
			name: input.name,
			goal: input.goal,
			agentName: input.agentName,
			agentVersion: input.agentVersion,
			environment: input.environment,
			metadata: input.metadata
		})
		.returning();

	return run;
}

export async function findRun(publicRunId: string) {
	const [run] = await db.select().from(runs).where(eq(runs.publicId, publicRunId)).limit(1);
	return run;
}

export async function findRunForUser(publicRunId: string, ownerUserId: string) {
	const [run] = await db
		.select()
		.from(runs)
		.where(and(eq(runs.publicId, publicRunId), eq(runs.ownerUserId, ownerUserId)))
		.limit(1);
	return run;
}

export async function updateRun(
	publicRunId: string,
	input: { status: RunStatus; metadata?: unknown }
) {
	const endedAt = input.status === 'running' ? null : new Date();
	const [run] = await db
		.update(runs)
		.set({
			status: input.status,
			metadata: input.metadata,
			endedAt,
			updatedAt: new Date()
		})
		.where(eq(runs.publicId, publicRunId))
		.returning();

	return run;
}

export async function updateRunForUser(
	publicRunId: string,
	ownerUserId: string,
	input: { status: RunStatus; metadata?: unknown }
) {
	const endedAt = input.status === 'running' ? null : new Date();
	const [run] = await db
		.update(runs)
		.set({
			status: input.status,
			metadata: input.metadata,
			endedAt,
			updatedAt: new Date()
		})
		.where(and(eq(runs.publicId, publicRunId), eq(runs.ownerUserId, ownerUserId)))
		.returning();

	return run;
}

export async function patchRunMetadata(publicRunId: string, patch: Record<string, unknown>) {
	const run = await findRun(publicRunId);
	if (!run) return undefined;
	const currentMetadata =
		run.metadata && typeof run.metadata === 'object' && !Array.isArray(run.metadata)
			? run.metadata
			: {};
	const [updated] = await db
		.update(runs)
		.set({
			metadata: { ...currentMetadata, ...patch },
			updatedAt: new Date()
		})
		.where(eq(runs.publicId, publicRunId))
		.returning();

	return updated;
}

export async function listRuns(input: {
	ownerUserId: string;
	status?: RunStatus;
	q?: string;
	limit: number;
	offset: number;
}) {
	const filters = [
		eq(runs.ownerUserId, input.ownerUserId),
		input.status ? eq(runs.status, input.status) : undefined,
		input.q
			? or(
					ilike(runs.name, `%${input.q}%`),
					ilike(runs.goal, `%${input.q}%`),
					ilike(runs.agentName, `%${input.q}%`)
				)
			: undefined
	].filter(Boolean);
	const where = filters.length ? and(...filters) : undefined;

	const rows = await db
		.select({
			id: runs.publicId,
			name: runs.name,
			goal: runs.goal,
			status: runs.status,
			agentName: runs.agentName,
			agentVersion: runs.agentVersion,
			environment: runs.environment,
			startedAt: runs.startedAt,
			endedAt: runs.endedAt,
			eventCount: sql<number>`count(distinct ${events.id})`,
			latestEvaluationScore: sql<number | null>`(
				select ${evaluations.score}
				from ${evaluations}
				where ${evaluations.runId} = ${runs.id}
				order by ${evaluations.createdAt} desc
				limit 1
			)`,
			latestEvaluationStatus: sql<string | null>`(
				select ${evaluations.status}
				from ${evaluations}
				where ${evaluations.runId} = ${runs.id}
				order by ${evaluations.createdAt} desc
				limit 1
			)`
		})
		.from(runs)
		.leftJoin(events, eq(events.runId, runs.id))
		.where(where)
		.groupBy(runs.id)
		.orderBy(desc(runs.startedAt))
		.limit(input.limit)
		.offset(input.offset);

	const [{ total }] = await db.select({ total: count() }).from(runs).where(where);
	return { runs: rows, total };
}

export async function getRunDashboardMetricsForUser(ownerUserId: string) {
	const rows = await db
		.select({ status: runs.status, total: count() })
		.from(runs)
		.where(eq(runs.ownerUserId, ownerUserId))
		.groupBy(runs.status);
	const warningRows = await db
		.select({ total: count() })
		.from(evaluationFindings)
		.innerJoin(runs, eq(evaluationFindings.runId, runs.id))
		.where(
			and(
				eq(runs.ownerUserId, ownerUserId),
				or(eq(evaluationFindings.severity, 'warning'), eq(evaluationFindings.severity, 'error'))
			)
		);

	const metrics = {
		running: 0,
		success: 0,
		failed: 0,
		cancelled: 0,
		warnings: warningRows[0]?.total ?? 0
	};
	for (const row of rows) metrics[row.status] = row.total;
	const completed = metrics.success + metrics.failed + metrics.cancelled;
	const successRate = completed ? Math.round((metrics.success / completed) * 100) : 0;
	return { ...metrics, successRate };
}
