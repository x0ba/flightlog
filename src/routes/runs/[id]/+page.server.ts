import { error } from '@sveltejs/kit';
import { getRunSnapshot } from '$lib/server/agent-runner/service';
import { requireUserId } from '$lib/server/auth';
import { findRunForUser } from '$lib/server/runs';

export async function load(event) {
	const userId = requireUserId(event);
	const ownedRun = await findRunForUser(event.params.id, userId);
	if (!ownedRun) error(404, 'Run not found');
	const snapshot = await getRunSnapshot(ownedRun);
	return snapshot;
}
