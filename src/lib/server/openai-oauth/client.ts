import {
	DEFAULT_CODEX_CLIENT_ID,
	DEVICE_TOKEN_EXCHANGE_REDIRECT_URI,
	DEVICE_TOKEN_URL,
	DEVICE_USERCODE_URL,
	ID_TOKEN_TYPE,
	OAUTH_AUTH_URL,
	OAUTH_SCOPE,
	OAUTH_TOKEN_URL,
	TOKEN_EXCHANGE_GRANT
} from './constants';
import {
	OAuthAuthorizationError,
	OAuthRefreshFailedError,
	OAuthTokenExchangeFailedError
} from './errors';
import { generateCodeChallenge } from './pkce';

export type TokenEndpointResponse = {
	access_token: string;
	refresh_token: string;
	id_token: string;
	expires_in?: number;
	openai_api_key?: string;
};

type OAuthErrorBody = {
	error?: string;
	error_description?: string;
};

async function readOAuthError(response: Response) {
	try {
		const body = (await response.json()) as OAuthErrorBody;
		return {
			code: body.error ?? 'oauth_error',
			description: body.error_description
		};
	} catch {
		return { code: 'oauth_error', description: await response.text() };
	}
}

export function buildAuthorizationUrl(input: {
	clientId: string;
	redirectUri: string;
	codeVerifier: string;
	state: string;
}) {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: input.clientId,
		redirect_uri: input.redirectUri,
		scope: OAUTH_SCOPE,
		code_challenge: generateCodeChallenge(input.codeVerifier),
		code_challenge_method: 'S256',
		state: input.state,
		id_token_add_organizations: 'true',
		codex_cli_simplified_flow: 'true'
	});
	return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(input: {
	clientId: string;
	redirectUri: string;
	code: string;
	codeVerifier: string;
}) {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code: input.code,
		redirect_uri: input.redirectUri,
		client_id: input.clientId,
		code_verifier: input.codeVerifier
	});
	const response = await fetch(OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) {
		const oauthError = await readOAuthError(response);
		throw new OAuthAuthorizationError(oauthError.code, oauthError.description);
	}
	return (await response.json()) as TokenEndpointResponse;
}

export async function exchangeIdTokenForApiKey(input: { clientId: string; idToken: string }) {
	const body = new URLSearchParams({
		grant_type: TOKEN_EXCHANGE_GRANT,
		requested_token: 'openai-api-key',
		subject_token: input.idToken,
		subject_token_type: ID_TOKEN_TYPE,
		client_id: input.clientId
	});
	const response = await fetch(OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) {
		const oauthError = await readOAuthError(response);
		throw new OAuthTokenExchangeFailedError(oauthError.code, oauthError.description);
	}
	const payload = (await response.json()) as { openai_api_key?: string };
	if (!payload.openai_api_key) {
		throw new OAuthTokenExchangeFailedError('missing_api_key', 'No openai_api_key in response');
	}
	return payload.openai_api_key;
}

export async function refreshOAuthTokens(input: { clientId: string; refreshToken: string }) {
	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: input.refreshToken,
		client_id: input.clientId
	});
	const response = await fetch(OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) {
		const oauthError = await readOAuthError(response);
		throw new OAuthRefreshFailedError(oauthError.code, oauthError.description);
	}
	return (await response.json()) as TokenEndpointResponse;
}

export type DeviceCodeStartResponse = {
	device_auth_id: string;
	user_code: string;
	verification_uri?: string;
	interval?: number;
	expires_in?: number;
};

export async function startDeviceCodeFlow(clientId: string) {
	const response = await fetch(DEVICE_USERCODE_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ client_id: clientId })
	});
	if (!response.ok) {
		const oauthError = await readOAuthError(response);
		throw new OAuthAuthorizationError(oauthError.code, oauthError.description);
	}
	return (await response.json()) as DeviceCodeStartResponse;
}

export type DeviceCodePollResponse = {
	status?: string;
	authorization_code?: string;
	code_verifier?: string;
	code_challenge?: string;
	error?: string;
	error_description?: string;
};

export async function pollDeviceCodeToken(input: {
	deviceAuthId: string;
	userCode: string;
}) {
	const response = await fetch(DEVICE_TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			device_auth_id: input.deviceAuthId,
			user_code: input.userCode
		})
	});
	if (response.status === 404 || response.status === 428) {
		return { pending: true as const };
	}
	if (!response.ok) {
		const oauthError = await readOAuthError(response);
		throw new OAuthAuthorizationError(oauthError.code, oauthError.description);
	}
	const payload = (await response.json()) as DeviceCodePollResponse;
	if (payload.error) {
		throw new OAuthAuthorizationError(payload.error, payload.error_description);
	}
	if (!payload.authorization_code || !payload.code_verifier) {
		return { pending: true as const };
	}
	return { pending: false as const, payload };
}

export async function completeDeviceCodeLogin(input: {
	clientId: string;
	authorizationCode: string;
	codeVerifier: string;
}) {
	const tokens = await exchangeAuthorizationCode({
		clientId: input.clientId,
		redirectUri: DEVICE_TOKEN_EXCHANGE_REDIRECT_URI,
		code: input.authorizationCode,
		codeVerifier: input.codeVerifier
	});
	const apiKey = await exchangeIdTokenForApiKey({
		clientId: input.clientId,
		idToken: tokens.id_token
	});
	return { ...tokens, api_key: apiKey };
}

export async function completeAuthorizationCodeLogin(input: {
	clientId: string;
	redirectUri: string;
	code: string;
	codeVerifier: string;
}) {
	const tokens = await exchangeAuthorizationCode(input);
	const apiKey = await exchangeIdTokenForApiKey({
		clientId: input.clientId,
		idToken: tokens.id_token
	});
	return { ...tokens, api_key: apiKey };
}

export function defaultClientId() {
	return DEFAULT_CODEX_CLIENT_ID;
}
