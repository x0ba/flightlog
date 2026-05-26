import { env } from '$env/dynamic/public';
import { initializeClerkClient } from 'clerk-sveltekit/client';

initializeClerkClient(env.PUBLIC_CLERK_PUBLISHABLE_KEY ?? '', {
	afterSignInUrl: '/runs',
	afterSignUpUrl: '/runs',
	signInUrl: '/sign-in',
	signUpUrl: '/sign-up'
});
