import { requireUserId } from '$lib/server/auth';
import { findRegressionRunForUser } from '$lib/server/regression/runs';
import { error } from '@sveltejs/kit';

export async function load(event) {
	const userId = requireUserId(event);
	const detail = await findRegressionRunForUser(event.params.id, userId);
	if (!detail) error(404, 'Regression run not found');
	return detail;
}
