import { ok, parseJson, notFound } from '$lib/server/http';
import { requireUserId } from '$lib/server/auth';
import { decideApproval } from '$lib/server/agent-runner/service';
import { findRunForUser } from '$lib/server/runs';
import { approvalDecisionSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const run = await findRunForUser(event.params.id, userId);
	if (!run) notFound('Run not found');
	const input = await parseJson(event, approvalDecisionSchema);
	const approval = await decideApproval(event.params.id, input);
	if (!approval) notFound('Run not found');
	return ok({ approval: { id: approval.publicId, sequence: approval.sequence } });
}
