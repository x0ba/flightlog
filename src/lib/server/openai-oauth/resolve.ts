import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { providerCredentials } from '$lib/server/db/schema';
import { decryptSecret, encryptSecret } from '$lib/server/crypto/keys';
import { OAuthRefreshFailedError } from './errors';
import {
	ensureValidApiKey,
	parseSessionJson,
	serializeSession,
	type OpenAIOAuthSession
} from './session';

type ProviderCredentialRow = typeof providerCredentials.$inferSelect;

export type ResolvedOpenAICredential =
	| { row: ProviderCredentialRow; apiKey: string }
	| { row: ProviderCredentialRow; apiKey: string; accessToken: string };

export async function resolveOpenAICredential(
	ownerUserId: string,
	row: ProviderCredentialRow
): Promise<ResolvedOpenAICredential | undefined> {
	if (!row.isEnabled || row.ownerUserId !== ownerUserId || row.provider !== 'openai') {
		return undefined;
	}

	if (row.authType === 'api_key') {
		if (!row.encryptedApiKey) return undefined;
		return {
			row,
			apiKey: decryptSecret(row.encryptedApiKey)
		};
	}

	if (row.authType !== 'chatgpt_oauth' || !row.encryptedOAuthSession) {
		return undefined;
	}

	try {
		const session = parseSessionJson(decryptSecret(row.encryptedOAuthSession));
		const refreshed = await ensureValidApiKey(session);
		if (sessionChanged(session, refreshed)) {
			try {
				await persistOAuthSession(row.publicId, ownerUserId, refreshed);
			} catch (cause) {
				console.error('Failed to persist OAuth session after refresh', cause);
			}
		}
		return { row, apiKey: refreshed.apiKey, accessToken: refreshed.accessToken };
	} catch (cause) {
		if (cause instanceof OAuthRefreshFailedError) {
			try {
				await db
					.update(providerCredentials)
					.set({ isEnabled: false, updatedAt: new Date() })
					.where(
						and(
							eq(providerCredentials.publicId, row.publicId),
							eq(providerCredentials.ownerUserId, ownerUserId)
						)
					);
			} catch (disableError) {
				console.error('Failed to disable credential after OAuth refresh failure', disableError);
			}
		}
		throw cause;
	}
}

async function persistOAuthSession(
	publicCredentialId: string,
	ownerUserId: string,
	session: OpenAIOAuthSession
) {
	await db
		.update(providerCredentials)
		.set({
			encryptedOAuthSession: encryptSecret(serializeSession(session)),
			encryptedApiKey: encryptSecret(session.apiKey),
			accountEmail: session.accountEmail ?? null,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(providerCredentials.publicId, publicCredentialId),
				eq(providerCredentials.ownerUserId, ownerUserId)
			)
		);
}

function sessionChanged(before: OpenAIOAuthSession, after: OpenAIOAuthSession) {
	return (
		before.apiKey !== after.apiKey ||
		before.accessToken !== after.accessToken ||
		before.refreshToken !== after.refreshToken ||
		before.idToken !== after.idToken ||
		before.accessTokenExpiresAt !== after.accessTokenExpiresAt ||
		before.apiKeyExpiresAt !== after.apiKeyExpiresAt
	);
}
