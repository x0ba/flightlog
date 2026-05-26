import { env } from '$env/dynamic/private';
import { verifyToken } from '@clerk/backend';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { agentRunConfigs, providerCredentials, runs } from '$lib/server/db/schema';

export function readUserId(event: RequestEvent) {
	return event.locals.auth?.userId ?? event.locals.session?.userId;
}

export function requireUserId(event: RequestEvent) {
	const userId = readUserId(event);
	if (!userId) throw error(401, { message: 'Authentication required' });
	return userId;
}

export async function authenticateBearer(event: RequestEvent) {
	if (event.locals.session || event.locals.auth?.userId) return;
	const header = event.request.headers.get('authorization');
	const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!token || !env.CLERK_SECRET_KEY) return;
	try {
		const claims = await verifyToken(token, {
			secretKey: env.CLERK_SECRET_KEY,
			issuer: (issuer) => issuer.startsWith('https://clerk.') || issuer.includes('.clerk.accounts')
		});
		event.locals.auth = { userId: claims.sub, claims };
	} catch {
		// Invalid bearer tokens fall through to the normal protected-route 401.
	}
}

export async function claimLegacyRows(ownerUserId: string) {
	await Promise.all([
		db.update(runs).set({ ownerUserId }).where(isNull(runs.ownerUserId)),
		db
			.update(providerCredentials)
			.set({ ownerUserId })
			.where(isNull(providerCredentials.ownerUserId)),
		db.update(agentRunConfigs).set({ ownerUserId }).where(isNull(agentRunConfigs.ownerUserId))
	]);
}

export function isProtectedPath(pathname: string) {
	return (
		pathname === '/runs' ||
		pathname.startsWith('/runs/') ||
		pathname.startsWith('/api/runs') ||
		pathname.startsWith('/api/v1/traces') ||
		pathname.startsWith('/api/agent-runs') ||
		pathname.startsWith('/api/settings/providers')
	);
}

export function guardProtectedPath(event: RequestEvent) {
	if (!isProtectedPath(event.url.pathname)) return;
	if (readUserId(event)) return;
	if (event.url.pathname.startsWith('/api/')) {
		throw error(401, { message: 'Authentication required' });
	}
	throw redirect(303, `/sign-in?redirectUrl=${encodeURIComponent(event.url.pathname)}`);
}
