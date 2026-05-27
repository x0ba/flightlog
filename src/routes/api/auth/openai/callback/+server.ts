import { error, isRedirect, redirect } from '@sveltejs/kit';
import { requireUserId } from '$lib/server/auth';
import { createChatGptOAuthCredential } from '$lib/server/provider-credentials';
import {
	completeAuthorizationCodeLogin,
	OAuthAuthorizationError,
	readOpenAIOAuthConfig
} from '$lib/server/openai-oauth';
import {
	deleteConnectState,
	readConnectState
} from '$lib/server/openai-oauth/connect-state';
import { emailFromIdToken, sessionFromTokenResponse } from '$lib/server/openai-oauth/session';
import { OAUTH_STATE_COOKIE } from '../connect/+server';

export async function GET(event) {
	requireUserId(event);
	const config = readOpenAIOAuthConfig(event.url.origin);
	if (!config.redirectUri) {
		throw error(500, { message: 'OPENAI_OAUTH_REDIRECT_URI is not configured.' });
	}

	const oauthError = event.url.searchParams.get('error');
	if (oauthError) {
		const description = event.url.searchParams.get('error_description');
		const detail = description ? `${oauthError}: ${description}` : oauthError;
		throw error(400, { message: `OpenAI authorization failed: ${detail}` });
	}

	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const cookieState = event.cookies.get(OAUTH_STATE_COOKIE);
	if (!code || !state || !cookieState || state !== cookieState) {
		throw error(400, { message: 'Invalid OAuth callback state.' });
	}

	const connectState = await readConnectState(state);
	if (!connectState || !connectState.codeVerifier) {
		throw error(400, { message: 'OAuth session expired. Try connecting again.' });
	}

	event.cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });

	try {
		const tokens = await completeAuthorizationCodeLogin({
			clientId: config.clientId,
			redirectUri: config.redirectUri,
			code,
			codeVerifier: connectState.codeVerifier
		});
		const accountEmail = emailFromIdToken(tokens.id_token);
		const session = sessionFromTokenResponse(tokens, config.clientId, accountEmail);
		const credential = await createChatGptOAuthCredential(connectState.ownerUserId, {
			label: connectState.label,
			session
		});
		await deleteConnectState(state);
		const params = new URLSearchParams({
			keys: 'open',
			connected: '1',
			credentialId: credential.id
		});
		throw redirect(303, `/runs?${params.toString()}`);
	} catch (cause) {
		await deleteConnectState(state);
		if (isRedirect(cause)) throw cause;
		if (cause instanceof OAuthAuthorizationError) {
			throw error(400, { message: cause.message });
		}
		throw cause;
	}
}
