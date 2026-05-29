import { readUserId } from '$lib/server/auth';

export function load(event) {
	return {
		userId: readUserId(event),
		email: event.locals.auth?.user?.email ?? null
	};
}
