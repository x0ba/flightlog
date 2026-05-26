import { error } from '@sveltejs/kit';
import { requireUserId } from '$lib/server/auth';
import { getGithubInstallation, isGithubAppConfigured } from '$lib/server/github/app';
import { ok, parseJson } from '$lib/server/http';
import { findGithubInstallation, upsertGithubInstallation } from '$lib/server/regression/suites';
import { linkGithubInstallationSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	if (!isGithubAppConfigured()) {
		throw error(503, { message: 'GitHub App is not configured' });
	}

	const input = await parseJson(event, linkGithubInstallationSchema);
	const githubInstallation = await getGithubInstallation(input.installationId).catch(() => null);
	if (!githubInstallation) {
		throw error(404, { message: 'GitHub installation not found' });
	}

	const account = githubInstallation.account;
	const accountLogin =
		account && 'login' in account
			? account.login
			: account && 'slug' in account
				? account.slug
				: undefined;
	const accountType = githubInstallation.target_type;
	if (!accountLogin || accountLogin !== input.accountLogin || accountType !== input.accountType) {
		throw error(400, { message: 'Installation account details do not match' });
	}

	const existing = await findGithubInstallation(input.installationId);
	if (existing?.ownerUserId && existing.ownerUserId !== userId) {
		throw error(403, { message: 'Installation is already linked to another user' });
	}

	const installation = await upsertGithubInstallation({
		installationId: input.installationId,
		accountLogin: input.accountLogin,
		accountType: input.accountType,
		ownerUserId: userId
	});

	return ok(
		{
			installation: {
				id: installation.publicId,
				installationId: installation.installationId,
				accountLogin: installation.accountLogin,
				accountType: installation.accountType
			}
		},
		{ status: 201 }
	);
}

export async function GET(event) {
	const userId = requireUserId(event);
	const { eq } = await import('drizzle-orm');
	const { db } = await import('$lib/server/db');
	const { githubInstallations } = await import('$lib/server/db/schema');

	const installations = await db
		.select()
		.from(githubInstallations)
		.where(eq(githubInstallations.ownerUserId, userId));

	return ok({
		installations: installations.map((installation) => ({
			id: installation.publicId,
			installationId: installation.installationId,
			accountLogin: installation.accountLogin,
			accountType: installation.accountType
		}))
	});
}
