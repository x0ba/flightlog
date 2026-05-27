import { ok, parseJson, requireRunForUser } from '$lib/server/http';
import { requireUserId } from '$lib/server/auth';
import { decideApproval } from '$lib/server/agent-runner/service';
import { approvalDecisionSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const run = await requireRunForUser(event.params.id, userId, 'Run not found');
	const input = await parseJson(event, approvalDecisionSchema);
	const approval = await decideApproval(run, input);
	return ok({ approval: { id: approval.publicId, sequence: approval.sequence } });
}
