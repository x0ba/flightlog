import { DEFAULT_EXPIRES_IN_SECONDS, REFRESH_MARGIN_SECONDS } from './constants';
import { refreshOAuthTokens, resolveOAuthApiKey, type TokenEndpointResponse } from './client';

export type OpenAIOAuthSession = {
	clientId: string;
	accessToken: string;
	refreshToken: string;
	idToken: string;
	apiKey: string;
	accessTokenExpiresAt: number;
	apiKeyExpiresAt: number;
	accountEmail?: string;
};

export function sessionFromTokenResponse(
	payload: TokenEndpointResponse & { api_key: string },
	clientId: string,
	accountEmail?: string
): OpenAIOAuthSession {
	const now = Date.now();
	const expiresInMs = (payload.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000;
	return {
		clientId,
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token,
		idToken: payload.id_token,
		apiKey: payload.api_key,
		accessTokenExpiresAt: now + expiresInMs,
		apiKeyExpiresAt: now + expiresInMs,
		accountEmail
	};
}

export function parseSessionJson(raw: string): OpenAIOAuthSession {
	const parsed: unknown = JSON.parse(raw);
	if (!isOpenAIOAuthSession(parsed)) {
		throw new Error('Invalid OpenAI OAuth session');
	}
	return parsed;
}

export function serializeSession(session: OpenAIOAuthSession) {
	return JSON.stringify(session);
}

function shouldRefresh(session: OpenAIOAuthSession) {
	const marginMs = REFRESH_MARGIN_SECONDS * 1000;
	const now = Date.now();
	return (
		now >= session.accessTokenExpiresAt - marginMs || now >= session.apiKeyExpiresAt - marginMs
	);
}

function isOpenAIOAuthSession(value: unknown): value is OpenAIOAuthSession {
	if (!value || typeof value !== 'object') return false;
	const session = value as Record<string, unknown>;
	return (
		typeof session.clientId === 'string' &&
		typeof session.accessToken === 'string' &&
		typeof session.refreshToken === 'string' &&
		typeof session.idToken === 'string' &&
		typeof session.apiKey === 'string' &&
		typeof session.accessTokenExpiresAt === 'number' &&
		typeof session.apiKeyExpiresAt === 'number' &&
		(session.accountEmail === undefined || typeof session.accountEmail === 'string')
	);
}

export async function ensureValidApiKey(session: OpenAIOAuthSession) {
	if (!shouldRefresh(session)) return session;

	const tokens = await refreshOAuthTokens({
		clientId: session.clientId,
		refreshToken: session.refreshToken
	});
	const expiresInMs = (tokens.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000;
	const now = Date.now();
	const apiKey = await resolveOAuthApiKey(session.clientId, tokens);

	return {
		...session,
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token ?? session.refreshToken,
		idToken: tokens.id_token,
		apiKey,
		accessTokenExpiresAt: now + expiresInMs,
		apiKeyExpiresAt: now + expiresInMs
	};
}

export function emailFromIdToken(idToken: string) {
	try {
		const payload = idToken.split('.')[1];
		if (!payload) return undefined;
		const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
			email?: string;
		};
		return typeof decoded.email === 'string' ? decoded.email : undefined;
	} catch {
		return undefined;
	}
}
