import { getRunSnapshot } from '$lib/server/agent-runner/service';
import { requireUserId } from '$lib/server/auth';
import { requireRunForUser } from '$lib/server/http';

export async function load(event) {
	const userId = requireUserId(event);
	const ownedRun = await requireRunForUser(event.params.id, userId, 'Run not found');
	const snapshot = await getRunSnapshot(ownedRun);
	return snapshot;
}
