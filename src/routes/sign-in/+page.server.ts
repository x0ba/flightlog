import { redirect } from '@sveltejs/kit';
import { readPostAuthRedirectUrl, readUserId } from '$lib/server/auth';

export function load(event) {
	if (readUserId(event)) {
		throw redirect(303, readPostAuthRedirectUrl(event));
	}
	return {};
}
