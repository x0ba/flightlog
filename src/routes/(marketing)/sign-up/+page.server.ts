import { redirect } from '@sveltejs/kit';
import { authKit } from '@workos/authkit-sveltekit';
import { readUserId } from '$lib/server/auth';

export async function load(event) {
	if (readUserId(event)) {
		throw redirect(303, '/runs');
	}
	return {
		signUpUrl: await authKit.getSignUpUrl({ returnTo: '/runs' })
	};
}
