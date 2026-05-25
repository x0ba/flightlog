import { ok, parseJson, notFound } from '$lib/server/http';
import { decideApproval } from '$lib/server/agent-runner/service';
import { approvalDecisionSchema } from '$lib/server/validation';

export async function POST(event) {
	const input = await parseJson(event, approvalDecisionSchema);
	const approval = await decideApproval(event.params.id, input);
	if (!approval) notFound('Run not found');
	return ok({ approval: { id: approval.publicId, sequence: approval.sequence } });
}
