import { requireUserId } from '$lib/server/auth';
import { ok, parseJson } from '$lib/server/http';
import { upsertGithubInstallation } from '$lib/server/regression/suites';
import { linkGithubInstallationSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, linkGithubInstallationSchema);
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
