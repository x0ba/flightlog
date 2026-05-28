import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from './client';
import { ensureValidApiKey, emailFromIdToken, sessionFromTokenResponse } from './session';

describe('openai-oauth session', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('builds session from token response', () => {
		const session = sessionFromTokenResponse(
			{
				access_token: 'access',
				refresh_token: 'refresh',
				id_token: 'id',
				api_key: 'sk-test',
				expires_in: 3600
			},
			'client-id',
			'user@example.com'
		);
		expect(session.apiKey).toBe('sk-test');
		expect(session.accountEmail).toBe('user@example.com');
		expect(session.accessTokenExpiresAt).toBe(Date.now() + 3_600_000);
	});

	it('returns cached api key when not expired', async () => {
		const session = sessionFromTokenResponse(
			{
				access_token: 'access',
				refresh_token: 'refresh',
				id_token: 'id',
				api_key: 'sk-test',
				expires_in: 3600
			},
			'client-id'
		);
		const refreshSpy = vi.spyOn(client, 'refreshOAuthTokens');
		const result = await ensureValidApiKey(session);
		expect(result.apiKey).toBe('sk-test');
		expect(refreshSpy).not.toHaveBeenCalled();
	});

	it('refreshes when inside expiry margin', async () => {
		const session = sessionFromTokenResponse(
			{
				access_token: 'access',
				refresh_token: 'refresh',
				id_token: 'id',
				api_key: 'sk-old',
				expires_in: 30
			},
			'client-id'
		);
		vi.spyOn(client, 'refreshOAuthTokens').mockResolvedValue({
			access_token: 'access-new',
			refresh_token: 'refresh-new',
			id_token: 'id-new',
			expires_in: 3600
		});
		vi.spyOn(client, 'resolveOAuthApiKey').mockResolvedValue('sk-new');

		const result = await ensureValidApiKey(session);
		expect(result.apiKey).toBe('sk-new');
		expect(result.accessToken).toBe('access-new');
	});

	it('extracts email claim from id token payload', () => {
		const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
		const payload = Buffer.from(JSON.stringify({ email: 'dev@openai.com' })).toString('base64url');
		const email = emailFromIdToken(`${header}.${payload}.sig`);
		expect(email).toBe('dev@openai.com');
	});
});
