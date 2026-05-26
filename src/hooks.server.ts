import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { handleClerk } from 'clerk-sveltekit/server';
import {
	authenticateBearer,
	claimLegacyRows,
	guardProtectedPath,
	readUserId
} from '$lib/server/auth';

const clerk = handleClerk(env.CLERK_SECRET_KEY ?? '', {
	protectedPaths: []
});

export const handle: Handle = async ({ event, resolve }) => {
	const response = await clerk({
		event,
		resolve: async (clerkEvent) => {
			await authenticateBearer(clerkEvent);
			const userId = readUserId(clerkEvent);
			if (userId) await claimLegacyRows(userId);
			guardProtectedPath(clerkEvent);
			return resolve(clerkEvent);
		}
	});
	return response;
};
