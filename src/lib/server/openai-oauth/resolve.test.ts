import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { providerCredentials } from '$lib/server/db/schema';
import { resetDatabase } from '../../../../test/helpers/db';
import { createChatGptOAuthCredential } from '$lib/server/provider-credentials';
import { getProviderApiKey } from '$lib/server/provider-credentials';
import { decryptSecret } from '$lib/server/crypto/keys';
import * as session from './session';
import { parseSessionJson } from './session';

describe('resolveOpenAICredential integration', () => {
	beforeEach(async () => {
		await resetDatabase();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('returns refreshed api key for chatgpt oauth credentials', async () => {
		const credential = await createChatGptOAuthCredential('user_oauth', {
			label: 'Work ChatGPT',
			session: {
				clientId: 'client',
				accessToken: 'access',
				refreshToken: 'refresh',
				idToken: 'id',
				apiKey: 'sk-initial',
				accessTokenExpiresAt: Date.now() + 30_000,
				apiKeyExpiresAt: Date.now() + 30_000,
				accountEmail: 'dev@example.com'
			}
		});

		vi.spyOn(session, 'ensureValidApiKey').mockResolvedValue({
			clientId: 'client',
			accessToken: 'access-new',
			refreshToken: 'refresh-new',
			idToken: 'id-new',
			apiKey: 'sk-refreshed',
			accessTokenExpiresAt: Date.now() + 3_600_000,
			apiKeyExpiresAt: Date.now() + 3_600_000,
			accountEmail: 'dev@example.com'
		});

		const resolved = await getProviderApiKey('user_oauth', credential.id, 'openai');
		expect(resolved?.apiKey).toBe('sk-refreshed');
		expect(resolved?.credential.authType).toBe('chatgpt_oauth');

		const [row] = await db
			.select()
			.from(providerCredentials)
			.where(eq(providerCredentials.publicId, credential.id))
			.limit(1);
		expect(row?.isEnabled).toBe(true);
		expect(row?.encryptedOAuthSession).toBeTruthy();
		expect(row?.encryptedApiKey).toBeTruthy();
		const persisted = parseSessionJson(decryptSecret(row!.encryptedOAuthSession!));
		expect(persisted.apiKey).toBe('sk-refreshed');
		expect(persisted.refreshToken).toBe('refresh-new');
		expect(decryptSecret(row!.encryptedApiKey!)).toBe('sk-refreshed');
	});

	it('disables credential when refresh fails', async () => {
		const credential = await createChatGptOAuthCredential('user_oauth_fail', {
			label: 'Broken',
			session: {
				clientId: 'client',
				accessToken: 'access',
				refreshToken: 'refresh',
				idToken: 'id',
				apiKey: 'sk-initial',
				accessTokenExpiresAt: Date.now() + 30_000,
				apiKeyExpiresAt: Date.now() + 30_000
			}
		});

		const { OAuthRefreshFailedError } = await import('./errors');
		vi.spyOn(session, 'ensureValidApiKey').mockRejectedValue(
			new OAuthRefreshFailedError('invalid_grant', 'revoked')
		);

		await expect(
			getProviderApiKey('user_oauth_fail', credential.id, 'openai')
		).rejects.toBeInstanceOf(OAuthRefreshFailedError);

		const [row] = await db
			.select()
			.from(providerCredentials)
			.where(
				and(
					eq(providerCredentials.publicId, credential.id),
					eq(providerCredentials.ownerUserId, 'user_oauth_fail')
				)
			)
			.limit(1);
		expect(row?.isEnabled).toBe(false);
	});
});
