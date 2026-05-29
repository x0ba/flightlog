import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/private';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { authKitHandle, configureAuthKit } from '@workos/authkit-sveltekit';
import { authenticateBearer, guardProtectedPath } from '$lib/server/auth';
import { getPostHogClient } from '$lib/server/posthog';

configureAuthKit({
	clientId: env.WORKOS_CLIENT_ID ?? '',
	apiKey: env.WORKOS_API_KEY ?? '',
	redirectUri: env.WORKOS_REDIRECT_URI ?? '',
	cookiePassword: env.WORKOS_COOKIE_PASSWORD ?? ''
});

const ingestProxy: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname.startsWith('/ingest')) {
		const useAssetHost =
			pathname.startsWith('/ingest/static/') || pathname.startsWith('/ingest/array/');
		const hostname = useAssetHost ? 'us-assets.i.posthog.com' : 'us.i.posthog.com';

		const url = new URL(event.request.url);
		url.protocol = 'https:';
		url.hostname = hostname;
		url.port = '443';
		url.pathname = pathname.replace(/^\/ingest/, '');

		const headers = new Headers(event.request.headers);
		headers.set('host', hostname);
		headers.set('accept-encoding', '');

		const clientIp = event.request.headers.get('x-forwarded-for') || event.getClientAddress();
		if (clientIp) {
			headers.set('x-forwarded-for', clientIp);
		}

		const response = await fetch(url.toString(), {
			method: event.request.method,
			headers,
			body: event.request.body,
			// @ts-expect-error - duplex is required for streaming request bodies
			duplex: 'half'
		});
		return response;
	}
	return resolve(event);
};

export const handle: Handle = sequence(
	Sentry.sentryHandle(),
	ingestProxy,
	async ({ event, resolve }) => {
		const response = await authKitHandle()({
			event,
			resolve: async (authEvent) => {
				await authenticateBearer(authEvent);
				guardProtectedPath(authEvent);
				return resolve(authEvent);
			}
		});
		return response;
	}
);

export const handleError: HandleServerError = async ({ error, status, message }) => {
	Sentry.captureException(error);
	const posthog = getPostHogClient();
	posthog.capture({
		distinctId: 'server',
		event: 'server_error',
		properties: {
			error: error instanceof Error ? error.message : String(error),
			status,
			message
		}
	});
	return { message, status };
};
