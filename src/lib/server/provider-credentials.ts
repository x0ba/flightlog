import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { providerCredentials } from '$lib/server/db/schema';
import { decryptSecret, encryptSecret } from '$lib/server/crypto/keys';
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
			label: input.label,
			encryptedApiKey: encryptSecret(input.apiKey),
			keyPreview: previewKey(input.apiKey)
		})
		.returning();
	return redactCredential(row);
}

export async function updateProviderCredential(
	ownerUserId: string,
	publicCredentialId: string,
	input: UpdateCredentialInput
) {
	const patch: Partial<typeof providerCredentials.$inferInsert> = {
		updatedAt: new Date()
	};
	if (input.label !== undefined) patch.label = input.label;
	if (input.isEnabled !== undefined) patch.isEnabled = input.isEnabled;
	if (input.apiKey !== undefined) {
		patch.encryptedApiKey = encryptSecret(input.apiKey);
		patch.keyPreview = previewKey(input.apiKey);
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
	provider?: 'openai' | 'anthropic'
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
	return {
		credential: redactCredential(row),
		apiKey: decryptSecret(row.encryptedApiKey)
	};
}

function redactCredential(row: typeof providerCredentials.$inferSelect) {
	return {
		id: row.publicId,
		provider: row.provider,
		label: row.label,
		keyPreview: row.keyPreview,
		isEnabled: row.isEnabled,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function previewKey(apiKey: string) {
	const trimmed = apiKey.trim();
	if (trimmed.length <= 8) return '...' + trimmed.slice(-4);
	return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
