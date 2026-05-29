import { env } from '$env/dynamic/private';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readPostAuthRedirectUrl as readPostAuthRedirectUrlFromSearchParams } from '$lib/auth-redirect';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';

export { safeRedirectPath } from '$lib/auth-redirect';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks(clientId: string) {
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`));
	}
	return jwks;
}

export function readPostAuthRedirectUrl(event: RequestEvent, fallback?: `/${string}`) {
	return readPostAuthRedirectUrlFromSearchParams(event.url.searchParams, fallback);
}

export function readUserId(event: RequestEvent) {
	return event.locals.auth?.user?.id ?? event.locals.bearerUserId ?? undefined;
}

export function requireUserId(event: RequestEvent) {
	const userId = readUserId(event);
	if (!userId) throw error(401, { message: 'Authentication required' });
	return userId;
}

export async function authenticateBearer(event: RequestEvent) {
	if (event.locals.auth?.user?.id) return;
	const header = event.request.headers.get('authorization');
	const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!token || !env.WORKOS_CLIENT_ID) return;
	try {
		const { payload } = await jwtVerify(token, getJwks(env.WORKOS_CLIENT_ID), {
			issuer: 'https://api.workos.com',
			audience: env.WORKOS_CLIENT_ID
		});
		if (typeof payload.sub === 'string') {
			event.locals.bearerUserId = payload.sub;
		}
	} catch {
		// Invalid bearer tokens fall through to the normal protected-route 401.
	}
}

export function isProtectedPath(pathname: string) {
	return (
		pathname === '/runs' ||
		pathname.startsWith('/runs/') ||
		pathname === '/regression' ||
		pathname.startsWith('/regression/') ||
		pathname.startsWith('/api/runs') ||
		pathname.startsWith('/api/v1/traces') ||
		pathname.startsWith('/api/agent-runs') ||
		pathname.startsWith('/api/regression') ||
		pathname.startsWith('/api/github/installations') ||
		pathname.startsWith('/api/settings/providers') ||
		pathname.startsWith('/api/auth/openai')
	);
}

export function isPublicApiPath(pathname: string) {
	return pathname === '/api/github/webhook';
}

export function guardProtectedPath(event: RequestEvent) {
	if (isPublicApiPath(event.url.pathname)) return;
	if (!isProtectedPath(event.url.pathname)) return;
	if (readUserId(event)) return;
	if (event.url.pathname.startsWith('/api/')) {
		throw error(401, { message: 'Authentication required' });
	}
	const target = `${event.url.pathname}${event.url.search}`;
	throw redirect(303, `/sign-in?redirect_url=${encodeURIComponent(target)}`);
}
