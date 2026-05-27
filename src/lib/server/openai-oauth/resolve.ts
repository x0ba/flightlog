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

export async function resolveOpenAICredential(
	ownerUserId: string,
	publicCredentialId: string
) {
	const [row] = await db
		.select()
		.from(providerCredentials)
		.where(
			and(
				eq(providerCredentials.publicId, publicCredentialId),
				eq(providerCredentials.ownerUserId, ownerUserId),
				eq(providerCredentials.provider, 'openai')
			)
		)
		.limit(1);
	if (!row || !row.isEnabled) return undefined;

	if (row.authType === 'api_key') {
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
			await persistOAuthSession(row.publicId, ownerUserId, refreshed);
		}
		return { row, apiKey: refreshed.apiKey };
	} catch (cause) {
		if (cause instanceof OAuthRefreshFailedError) {
			await db
				.update(providerCredentials)
				.set({ isEnabled: false, updatedAt: new Date() })
				.where(
					and(
						eq(providerCredentials.publicId, publicCredentialId),
						eq(providerCredentials.ownerUserId, ownerUserId)
					)
				);
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
