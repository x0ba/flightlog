import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAUTH_TOKEN_URL, DEVICE_TOKEN_URL } from './constants';
import { OAUTH_SCOPE } from './constants';
import {
	apiKeyFromExchangeResponse,
	buildAuthorizationUrl,
	exchangeIdTokenForApiKey,
	isDevicePollPendingHttpStatus,
	pollDeviceCodeToken,
	resolveOAuthApiKey
} from './client';

const originalFetch = globalThis.fetch;

describe('buildAuthorizationUrl', () => {
	it('requests Codex CLI connector scopes', () => {
		const url = new URL(
			buildAuthorizationUrl({
				clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
				redirectUri: 'http://localhost:5173/api/auth/openai/callback',
				codeVerifier: 'verifier',
				state: 'state'
			})
		);
		expect(url.searchParams.get('scope')).toBe(OAUTH_SCOPE);
		expect(url.searchParams.get('scope')).toContain('api.connectors.read');
		expect(url.searchParams.get('scope')).toContain('api.connectors.invoke');
	});
});

describe('apiKeyFromExchangeResponse', () => {
	it('prefers access_token like Codex CLI', () => {
		expect(
			apiKeyFromExchangeResponse({
				access_token: 'oauth-access-key',
				openai_api_key: 'legacy-field'
			})
		).toBe('oauth-access-key');
	});

	it('falls back to openai_api_key', () => {
		expect(apiKeyFromExchangeResponse({ openai_api_key: 'sk-legacy' })).toBe('sk-legacy');
	});
});

describe('exchangeIdTokenForApiKey', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('reads access_token from token exchange response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'exchanged-key', expires_in: 3600 }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const apiKey = await exchangeIdTokenForApiKey({
			clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
			idToken: 'id-token'
		});

		expect(apiKey).toBe('exchanged-key');
		expect(globalThis.fetch).toHaveBeenCalledWith(
			OAUTH_TOKEN_URL,
			expect.objectContaining({ method: 'POST' })
		);
	});
});

describe('resolveOAuthApiKey', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('uses OAuth access_token when id token exchange fails', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: { message: 'denied', type: 'invalid_request' } }), {
				status: 400,
				headers: { 'content-type': 'application/json' }
			})
		);

		const apiKey = await resolveOAuthApiKey('app_EMoamEEZ73f0CkXaXp7hrann', {
			access_token: 'fallback-access',
			refresh_token: 'refresh',
			id_token: 'id-token'
		});

		expect(apiKey).toBe('fallback-access');
	});
});

describe('isDevicePollPendingHttpStatus', () => {
	it('treats Codex pending statuses as not ready', () => {
		expect(isDevicePollPendingHttpStatus(403)).toBe(true);
		expect(isDevicePollPendingHttpStatus(404)).toBe(true);
		expect(isDevicePollPendingHttpStatus(428)).toBe(true);
		expect(isDevicePollPendingHttpStatus(400)).toBe(false);
		expect(isDevicePollPendingHttpStatus(200)).toBe(false);
	});
});

describe('pollDeviceCodeToken', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('returns pending on HTTP 403 while user is authorizing', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
		globalThis.fetch = fetchMock;

		const result = await pollDeviceCodeToken({
			deviceAuthId: 'device-123',
			userCode: 'ABCD-EFGH'
		});

		expect(result).toEqual({ pending: true });
		expect(fetchMock).toHaveBeenCalledWith(
			DEVICE_TOKEN_URL,
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns tokens when authorization completes', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					authorization_code: 'auth-code',
					code_verifier: 'verifier',
					code_challenge: 'challenge'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		const result = await pollDeviceCodeToken({
			deviceAuthId: 'device-123',
			userCode: 'ABCD-EFGH'
		});

		expect(result.pending).toBe(false);
		if (!result.pending) {
			expect(result.payload.authorization_code).toBe('auth-code');
		}
	});
});
