import { requireUserId } from '$lib/server/auth';
import { notFound, ok, parseJson } from '$lib/server/http';
import { completeRegressionCaseRun } from '$lib/server/regression/runs';
import { completeRegressionCaseRunSchema } from '$lib/server/validation';

/** @type {import('@sveltejs/adapter-vercel').Config} */
export const config = {
	maxDuration: 300
};

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, completeRegressionCaseRunSchema);
	const result = await completeRegressionCaseRun({
		regressionRunPublicId: event.params.id,
		casePublicId: event.params.caseId,
		ownerUserId: userId,
		runPublicId: input.runId,
		constraints: input.constraints
	});
	if (!result) notFound('Regression case run not found');

	return ok({
		passed: result.caseResult.passed,
		reason: result.caseResult.reason,
		evaluation: {
			id: result.evaluation.publicId,
			score: result.evaluation.score,
			status: result.evaluation.status,
			summary: result.evaluation.summary
		}
	});
}
