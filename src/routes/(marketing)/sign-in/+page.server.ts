import { redirect } from '@sveltejs/kit';
import { authKit } from '@workos/authkit-sveltekit';
import { readPostAuthRedirectUrl, readUserId } from '$lib/server/auth';

export async function load(event) {
	if (readUserId(event)) {
		throw redirect(303, readPostAuthRedirectUrl(event));
	}
	return {
		signInUrl: await authKit.getSignInUrl({ returnTo: readPostAuthRedirectUrl(event) })
	};
}
