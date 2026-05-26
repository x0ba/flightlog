import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { evaluationFindings, evaluations, events, runs, spans } from '$lib/server/db/schema';
import { publicId } from '$lib/server/public-id';
import { evaluateRules } from './rules';
import { fallbackEvaluation, runLlmEvaluation } from './llm';

export async function evaluateRun(
	publicRunId: string,
	ownerUserId: string | undefined,
	constraints: string[]
) {
	const [run] = await db
		.select()
		.from(runs)
		.where(
			ownerUserId
				? and(eq(runs.publicId, publicRunId), eq(runs.ownerUserId, ownerUserId))
				: eq(runs.publicId, publicRunId)
		)
		.limit(1);
	if (!run) return undefined;

	const eventsList = await db
		.select()
		.from(events)
		.where(eq(events.runId, run.id))
		.orderBy(events.sequence);
	const spanList = await db.select().from(spans).where(eq(spans.runId, run.id));
	const ruleSummary = evaluateRules(eventsList);

	const [evaluation] = await db
		.insert(evaluations)
		.values({
			publicId: publicId('eval'),
			runId: run.id,
			status: 'running',
			repeatedActions: ruleSummary.repeatedActions,
			neededHumanApproval: ruleSummary.neededHumanApproval,
			violatedConstraints: ruleSummary.violatedConstraints,
			data: { constraints, ruleSummary }
		})
		.returning();

	try {
		const llm = await runLlmEvaluation({
			run,
			events: eventsList,
			spans: spanList,
			constraints,
			ruleSummary
		});
		const result = llm.skipped
			? fallbackEvaluation({
					goalCompleted: run.status === 'success',
					violatedConstraints: ruleSummary.violatedConstraints,
					score: run.status === 'success' && !ruleSummary.violatedConstraints ? 80 : 40,
					summary: 'Rule-based evaluation completed without LLM assistance.',
					explanation: llm.reason,
					findings: [
						...ruleSummary.findings,
						{
							severity: 'info',
							category: 'other',
							message: llm.reason
						}
					]
				})
			: llm.evaluation;

		const [updated] = await db
			.update(evaluations)
			.set({
				status: 'completed',
				goalCompleted: result.goalCompleted,
				violatedConstraints: result.violatedConstraints || ruleSummary.violatedConstraints,
				repeatedActions: ruleSummary.repeatedActions,
				neededHumanApproval: ruleSummary.neededHumanApproval,
				score: result.score,
				summary: result.summary,
				explanation: result.explanation,
				data: { constraints, ruleSummary },
				completedAt: new Date()
			})
			.where(eq(evaluations.id, evaluation.id))
			.returning();

		await insertFindings(updated.id, run.id, result.findings, eventsList);
		return updated;
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown evaluation error';
		const [failed] = await db
			.update(evaluations)
			.set({
				status: 'failed',
				summary: 'Evaluation failed.',
				explanation: message,
				data: { constraints, ruleSummary, error: message },
				completedAt: new Date()
			})
			.where(eq(evaluations.id, evaluation.id))
			.returning();
		await insertFindings(failed.id, run.id, ruleSummary.findings, eventsList);
		return failed;
	}
}

async function insertFindings(
	evaluationId: number,
	runId: number,
	findings: Array<{
		severity: 'info' | 'warning' | 'error';
		category:
			| 'goal_completion'
			| 'constraint_violation'
			| 'repetition'
			| 'human_approval'
			| 'tool_failure'
			| 'other';
		message: string;
		eventPublicId?: string;
	}>,
	eventsList: Array<typeof events.$inferSelect>
) {
	if (!findings.length) return;
	const rows = findings.map((finding) => ({
		evaluationId,
		runId,
		severity: finding.severity,
		category: finding.category,
		message: finding.message,
		eventId: finding.eventPublicId
			? eventsList.find((event) => event.publicId === finding.eventPublicId)?.id
			: undefined,
		data: finding
	}));
	await db.insert(evaluationFindings).values(rows);
}
