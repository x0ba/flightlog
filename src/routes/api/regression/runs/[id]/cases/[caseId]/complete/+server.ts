import { requireUserId } from '$lib/server/auth';
import { conflict, notFound, ok, parseJson } from '$lib/server/http';
import { completeRegressionCaseRun } from '$lib/server/regression/runs';
import { completeRegressionCaseRunSchema } from '$lib/server/validation';

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
	if (result.status === 'in_progress') {
		conflict('Regression case run is already in progress');
	}
	if (result.status === 'not_found') notFound('Regression case run not found');

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
