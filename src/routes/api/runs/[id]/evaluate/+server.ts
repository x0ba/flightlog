import { evaluateRun } from '$lib/server/evaluation/service';
import { ok, parseJson, notFound } from '$lib/server/http';
import { evaluateRunSchema } from '$lib/server/validation';

export async function POST(event) {
	const input = await parseJson(event, evaluateRunSchema);
	const evaluation = await evaluateRun(event.params.id, input.constraints);
	if (!evaluation) notFound('Run not found');
	return ok({
		evaluation: {
			id: evaluation.publicId,
			status: evaluation.status,
			goalCompleted: evaluation.goalCompleted,
			violatedConstraints: evaluation.violatedConstraints,
			repeatedActions: evaluation.repeatedActions,
			neededHumanApproval: evaluation.neededHumanApproval,
			score: evaluation.score
		}
	});
}
