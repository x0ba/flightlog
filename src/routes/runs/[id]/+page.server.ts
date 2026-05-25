import { error } from '@sveltejs/kit';
import { getRunSnapshot } from '$lib/server/agent-runner/service';

export async function load({ params }) {
	const snapshot = await getRunSnapshot(params.id);
	if (!snapshot) error(404, 'Run not found');
	return snapshot;
}
