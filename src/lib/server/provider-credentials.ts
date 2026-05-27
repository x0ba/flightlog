import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { providerCredentials } from '$lib/server/db/schema';
import { decryptSecret, encryptSecret } from '$lib/server/crypto/keys';
import {
	emailFromIdToken,
	serializeSession,
	type OpenAIOAuthSession
} from '$lib/server/openai-oauth/session';
import { publicId } from '$lib/server/public-id';
import type {
	createProviderCredentialSchema,
	updateProviderCredentialSchema
} from '$lib/server/validation';
import type { z } from 'zod';

export const modelCatalog = {
	openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'computer-use-preview'],
	anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1']
} as const;

export const defaultTools = ['calculator.evaluate', 'web.fetchText', 'web.searchMock', 'time.now'];

type CreateCredentialInput = z.infer<typeof createProviderCredentialSchema>;
type UpdateCredentialInput = z.infer<typeof updateProviderCredentialSchema>;
type Provider = CreateCredentialInput['provider'];

export async function listProviderCredentials(ownerUserId: string) {
	const rows = await db
		.select()
		.from(providerCredentials)
		.where(eq(providerCredentials.ownerUserId, ownerUserId));
	return rows.map(redactCredential);
}

export async function createProviderCredential(ownerUserId: string, input: CreateCredentialInput) {
	const [row] = await db
		.insert(providerCredentials)
		.values({
			publicId: publicId('cred'),
			ownerUserId,
			provider: input.provider,
			authType: 'api_key',
			label: input.label,
			encryptedApiKey: encryptSecret(input.apiKey),
			keyPreview: previewKey(input.apiKey),
			browserbaseProjectId: input.provider === 'browserbase' ? (input.projectId ?? null) : null
		})
		.returning();
	return redactCredential(row);
}

export async function createChatGptOAuthCredential(
	ownerUserId: string,
	input: { label: string; session: OpenAIOAuthSession }
) {
	const accountEmail =
		input.session.accountEmail ?? emailFromIdToken(input.session.idToken) ?? undefined;
	const session = { ...input.session, accountEmail };
	const [row] = await db
		.insert(providerCredentials)
		.values({
			publicId: publicId('cred'),
			ownerUserId,
			provider: 'openai',
			authType: 'chatgpt_oauth',
			label: input.label.trim() || accountEmail || 'ChatGPT',
			encryptedApiKey: encryptSecret(session.apiKey),
			encryptedOAuthSession: encryptSecret(serializeSession(session)),
			accountEmail: accountEmail ?? null,
			keyPreview: oauthKeyPreview(accountEmail, session.apiKey),
			browserbaseProjectId: null
		})
		.returning();
	return redactCredential(row);
}

export async function updateProviderCredential(
	ownerUserId: string,
	publicCredentialId: string,
	input: UpdateCredentialInput
) {
	const [existing] = await db
		.select()
		.from(providerCredentials)
		.where(
			and(
				eq(providerCredentials.publicId, publicCredentialId),
				eq(providerCredentials.ownerUserId, ownerUserId)
			)
		)
		.limit(1);
	if (!existing) return undefined;

	const patch: Partial<typeof providerCredentials.$inferInsert> = {
		updatedAt: new Date()
	};
	if (input.label !== undefined) patch.label = input.label;
	if (input.isEnabled !== undefined) patch.isEnabled = input.isEnabled;
	if (input.apiKey !== undefined && existing.authType === 'api_key') {
		patch.encryptedApiKey = encryptSecret(input.apiKey);
		patch.keyPreview = previewKey(input.apiKey);
	}
	if (input.projectId !== undefined) {
		if (existing.provider !== 'browserbase') return undefined;
		patch.browserbaseProjectId = input.projectId;
	}

	const [row] = await db
		.update(providerCredentials)
		.set(patch)
		.where(
			and(
				eq(providerCredentials.publicId, publicCredentialId),
				eq(providerCredentials.ownerUserId, ownerUserId)
			)
		)
		.returning();
	return row ? redactCredential(row) : undefined;
}

export async function deleteProviderCredential(ownerUserId: string, publicCredentialId: string) {
	const [row] = await db
		.delete(providerCredentials)
		.where(
			and(
				eq(providerCredentials.publicId, publicCredentialId),
				eq(providerCredentials.ownerUserId, ownerUserId)
			)
		)
		.returning({ publicId: providerCredentials.publicId });
	return row;
}

export async function getProviderApiKey(
	ownerUserId: string,
	publicCredentialId: string,
	provider?: Provider
) {
	const [row] = await db
		.select()
		.from(providerCredentials)
		.where(
			and(
				eq(providerCredentials.publicId, publicCredentialId),
				eq(providerCredentials.ownerUserId, ownerUserId)
			)
		)
		.limit(1);
	if (!row || !row.isEnabled) return undefined;
	if (provider && row.provider !== provider) return undefined;

	if (row.provider === 'openai' && row.authType === 'chatgpt_oauth') {
		const { resolveOpenAICredential } = await import('$lib/server/openai-oauth/resolve');
		const resolved = await resolveOpenAICredential(ownerUserId, row);
		if (!resolved) return undefined;
		return {
			credential: redactCredential(resolved.row),
			apiKey: resolved.apiKey,
			projectId: resolved.row.browserbaseProjectId ?? undefined
		};
	}

	if (row.authType !== 'api_key' || !row.encryptedApiKey) return undefined;

	return {
		credential: redactCredential(row),
		apiKey: decryptSecret(row.encryptedApiKey),
		projectId: row.browserbaseProjectId ?? undefined
	};
}

function redactCredential(row: typeof providerCredentials.$inferSelect) {
	return {
		id: row.publicId,
		provider: row.provider,
		authType: row.authType,
		label: row.label,
		accountEmail: row.accountEmail ?? undefined,
		keyPreview: row.keyPreview ?? 'ChatGPT OAuth',
		projectId: row.browserbaseProjectId ?? undefined,
		isEnabled: row.isEnabled,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function previewKey(apiKey: string) {
	const trimmed = apiKey.trim();
	if (trimmed.length <= 4) return '••••';
	return `...${trimmed.slice(-4)}`;
}

function oauthKeyPreview(accountEmail: string | undefined, apiKey: string) {
	if (accountEmail) {
		const [local, domain] = accountEmail.split('@');
		if (!domain) return accountEmail;
		const maskedLocal = local.length <= 2 ? `${local[0] ?? ''}•` : `${local.slice(0, 2)}•••`;
		return `${maskedLocal}@${domain}`;
	}
	return previewKey(apiKey);
}
