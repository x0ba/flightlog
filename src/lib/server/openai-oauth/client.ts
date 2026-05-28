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
	error?:
		| string
		| {
				message?: string;
				type?: string;
				code?: string | null;
		  };
	error_description?: string;
};

type ApiKeyExchangeResponse = {
	access_token?: string;
	openai_api_key?: string;
	expires_in?: number;
};

async function readOAuthError(response: Response) {
	const text = await response.text();
	try {
		const body = JSON.parse(text) as OAuthErrorBody;
		if (body.error && typeof body.error === 'object') {
			return {
				code: body.error.type ?? body.error.code ?? 'oauth_error',
				description: body.error.message ?? body.error_description ?? text
			};
		}
		return {
			code: typeof body.error === 'string' ? body.error : 'oauth_error',
			description: body.error_description ?? text
		};
	} catch {
		return { code: 'oauth_error', description: text };
	}
}

/** Codex returns the exchanged API credential in `access_token` (RFC 8693), not `openai_api_key`. */
export function apiKeyFromExchangeResponse(payload: ApiKeyExchangeResponse) {
	return payload.access_token?.trim() || payload.openai_api_key?.trim() || undefined;
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
	const payload = (await response.json()) as ApiKeyExchangeResponse;
	const apiKey = apiKeyFromExchangeResponse(payload);
	if (!apiKey) {
		throw new OAuthTokenExchangeFailedError(
			'missing_api_key',
			'No access_token in token exchange response'
		);
	}
	return apiKey;
}

export async function resolveOAuthApiKey(clientId: string, tokens: TokenEndpointResponse) {
	if (tokens.openai_api_key?.trim()) {
		return tokens.openai_api_key.trim();
	}
	try {
		return await exchangeIdTokenForApiKey({ clientId, idToken: tokens.id_token });
	} catch (cause) {
		if (tokens.access_token?.trim()) {
			return tokens.access_token.trim();
		}
		throw cause;
	}
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

/** Matches OpenAI Codex CLI: user has not finished authorizing yet. */
export function isDevicePollPendingHttpStatus(status: number) {
	return status === 403 || status === 404 || status === 428;
}

function isDevicePollPendingOAuthError(code: string) {
	return code === 'authorization_pending' || code === 'slow_down';
}

export async function pollDeviceCodeToken(input: { deviceAuthId: string; userCode: string }) {
	const response = await fetch(DEVICE_TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			device_auth_id: input.deviceAuthId,
			user_code: input.userCode
		})
	});
	if (isDevicePollPendingHttpStatus(response.status)) {
		return { pending: true as const };
	}
	if (!response.ok) {
		const oauthError = await readOAuthError(response);
		if (isDevicePollPendingOAuthError(oauthError.code)) {
			return { pending: true as const };
		}
		throw new OAuthAuthorizationError(oauthError.code, oauthError.description);
	}
	const payload = (await response.json()) as DeviceCodePollResponse;
	if (payload.error) {
		if (isDevicePollPendingOAuthError(payload.error)) {
			return { pending: true as const };
		}
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
	const apiKey = await resolveOAuthApiKey(input.clientId, tokens);
	return { ...tokens, api_key: apiKey };
}

export async function completeAuthorizationCodeLogin(input: {
	clientId: string;
	redirectUri: string;
	code: string;
	codeVerifier: string;
}) {
	const tokens = await exchangeAuthorizationCode(input);
	const apiKey = await resolveOAuthApiKey(input.clientId, tokens);
	return { ...tokens, api_key: apiKey };
}

export function defaultClientId() {
	return DEFAULT_CODEX_CLIENT_ID;
}
