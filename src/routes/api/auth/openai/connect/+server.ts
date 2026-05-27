import { error, redirect } from '@sveltejs/kit';
import { requireUserId } from '$lib/server/auth';
import {
	buildAuthorizationUrl,
	generateCodeVerifier,
	OAUTH_STATE_COOKIE,
	readOpenAIOAuthConfig,
	shouldUseDeviceAuth
} from '$lib/server/openai-oauth';
import { createRedirectConnectState } from '$lib/server/openai-oauth/connect-state';

export async function GET(event) {
	const userId = requireUserId(event);
	const label = event.url.searchParams.get('label')?.trim() || 'ChatGPT';
	const config = readOpenAIOAuthConfig(event.url.origin);

	if (shouldUseDeviceAuth(config)) {
		throw error(400, {
			message: 'Device auth required. Start via POST /api/auth/openai/device/start.'
		});
	}
	if (!config.redirectUri) {
		throw error(500, { message: 'OPENAI_OAUTH_REDIRECT_URI is not configured.' });
	}

	const codeVerifier = generateCodeVerifier();
	const { state } = await createRedirectConnectState({
		ownerUserId: userId,
		label,
		codeVerifier
	});

	event.cookies.set(OAUTH_STATE_COOKIE, state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: event.url.protocol === 'https:',
		maxAge: 60 * 10
	});

	const authorizationUrl = buildAuthorizationUrl({
		clientId: config.clientId,
		redirectUri: config.redirectUri,
		codeVerifier,
		state
	});

	throw redirect(302, authorizationUrl);
}
