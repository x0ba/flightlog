import { error } from '@sveltejs/kit';
import { requireUserId } from '$lib/server/auth';
import { ok } from '$lib/server/http';
import { createChatGptOAuthCredential } from '$lib/server/provider-credentials';
import {
	completeDeviceCodeLogin,
	DEVICE_CODE_MAX_WAIT_MS,
	OAuthAuthorizationError,
	pollDeviceCodeToken,
	readOpenAIOAuthConfig
} from '$lib/server/openai-oauth';
import {
	deleteConnectState,
	readDeviceConnectState
} from '$lib/server/openai-oauth/connect-state';
import { emailFromIdToken, sessionFromTokenResponse } from '$lib/server/openai-oauth/session';

export async function GET(event) {
	const userId = requireUserId(event);
	const deviceAuthId = event.url.searchParams.get('deviceAuthId')?.trim();
	if (!deviceAuthId) {
		throw error(400, { message: 'deviceAuthId is required.' });
	}

	const connectState = await readDeviceConnectState(deviceAuthId);
	if (!connectState) {
		throw error(404, { message: 'Device auth session not found or expired.' });
	}
	if (connectState.ownerUserId !== userId) {
		throw error(403, { message: 'Device auth session does not belong to this user.' });
	}
	if (!connectState.userCode) {
		throw error(400, { message: 'Device auth session is missing user code.' });
	}

	const elapsed = Date.now() - connectState.createdAt.getTime();
	if (elapsed > DEVICE_CODE_MAX_WAIT_MS) {
		await deleteConnectState(connectState.state);
		throw error(408, { message: 'Device auth timed out. Start a new connection.' });
	}

	const poll = await pollDeviceCodeToken({
		deviceAuthId,
		userCode: connectState.userCode
	});
	if (poll.pending) {
		return ok({
			status: 'pending' as const,
			pollIntervalMs: connectState.pollIntervalMs ?? 5000
		});
	}

	try {
		const config = readOpenAIOAuthConfig(event.url.origin);
		const tokens = await completeDeviceCodeLogin({
			clientId: config.clientId,
			authorizationCode: poll.payload.authorization_code!,
			codeVerifier: poll.payload.code_verifier!
		});
		const accountEmail = emailFromIdToken(tokens.id_token);
		const session = sessionFromTokenResponse(tokens, config.clientId, accountEmail);
		const credential = await createChatGptOAuthCredential(userId, {
			label: connectState.label,
			session
		});
		await deleteConnectState(connectState.state);
		return ok({
			status: 'completed' as const,
			credential
		});
	} catch (cause) {
		await deleteConnectState(connectState.state);
		if (cause instanceof OAuthAuthorizationError) {
			throw error(400, { message: cause.message });
		}
		throw cause;
	}
}
