import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { handleClerk } from 'clerk-sveltekit/server';
import { authenticateBearer, guardProtectedPath } from '$lib/server/auth';
import { registerGithubWebhookHandlers } from '$lib/server/github/webhooks';

registerGithubWebhookHandlers();

const clerk = handleClerk(env.CLERK_SECRET_KEY ?? '', {
	protectedPaths: []
});

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
	const response = await clerk({
		event,
		resolve: async (clerkEvent) => {
			await authenticateBearer(clerkEvent);
			guardProtectedPath(clerkEvent);
			return resolve(clerkEvent);
		}
	});
	return response;
});
export const handleError = Sentry.handleErrorWithSentry();
