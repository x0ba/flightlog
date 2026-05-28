import { error } from '@sveltejs/kit';
import { requireUserId } from '$lib/server/auth';
import { ok } from '$lib/server/http';
import {
	createChatGptOAuthCredential,
	getRedactedProviderCredential
} from '$lib/server/provider-credentials';
import {
	completeDeviceCodeLogin,
	DEVICE_CODE_MAX_WAIT_MS,
	OAuthAuthorizationError,
	OAuthTokenExchangeFailedError,
	pollDeviceCodeToken,
	readOpenAIOAuthConfig
} from '$lib/server/openai-oauth';
import {
	markDeviceConnectCompleted,
	readDeviceConnectState
} from '$lib/server/openai-oauth/connect-state';
import { emailFromIdToken, sessionFromTokenResponse } from '$lib/server/openai-oauth/session';

const MIN_DEVICE_POLL_INTERVAL_MS = 1000;

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

	if (connectState.completedCredentialPublicId) {
		const credential = await getRedactedProviderCredential(
			userId,
			connectState.completedCredentialPublicId
		);
		if (credential) {
			return ok({
				status: 'completed' as const,
				credential
			});
		}
	}

	const elapsed = Date.now() - connectState.createdAt.getTime();
	if (elapsed > DEVICE_CODE_MAX_WAIT_MS) {
		throw error(408, { message: 'Device auth timed out. Start a new connection.' });
	}

	let poll;
	try {
		poll = await pollDeviceCodeToken({
			deviceAuthId,
			userCode: connectState.userCode
		});
	} catch (cause) {
		if (cause instanceof OAuthAuthorizationError) {
			throw error(400, { message: cause.message });
		}
		throw cause;
	}
	if (poll.pending) {
		const pollIntervalMs = Math.max(
			connectState.pollIntervalMs ?? 5000,
			MIN_DEVICE_POLL_INTERVAL_MS
		);
		return ok({
			status: 'pending' as const,
			pollIntervalMs
		});
	}

	try {
		const config = readOpenAIOAuthConfig(event.url.origin);
		const { authorization_code, code_verifier } = poll.payload;
		if (!authorization_code || !code_verifier) {
			throw error(500, {
				message: 'Device auth payload missing authorization_code or code_verifier.'
			});
		}
		const tokens = await completeDeviceCodeLogin({
			clientId: config.clientId,
			authorizationCode: authorization_code,
			codeVerifier: code_verifier
		});
		const accountEmail = emailFromIdToken(tokens.id_token);
		const session = sessionFromTokenResponse(tokens, config.clientId, accountEmail);
		const credential = await createChatGptOAuthCredential(userId, {
			label: connectState.label,
			session
		});
		await markDeviceConnectCompleted(connectState.state, credential.id);
		return ok({
			status: 'completed' as const,
			credential
		});
	} catch (cause) {
		if (
			cause instanceof OAuthAuthorizationError ||
			cause instanceof OAuthTokenExchangeFailedError
		) {
			throw error(400, { message: cause.message });
		}
		throw cause;
	}
}
