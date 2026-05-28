import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { regressionRuns } from '$lib/server/db/schema';
import { createRegressionRunForRepository } from '$lib/server/regression/runs';
import { scheduleRegressionRun } from '$lib/server/regression/executor';
import { deleteGithubInstallation, upsertGithubInstallation } from '$lib/server/regression/suites';
import { getGithubApp, isGithubAppConfigured } from './app';
import { CHECK_NAME, createRegressionCheckRun } from './checks';

type PullRequestPayload = {
	action: string;
	number: number;
	pull_request: {
		head: { sha: string; ref: string };
	};
	repository: {
		name: string;
		owner: { login: string };
	};
	installation?: { id: number };
};

type InstallationPayload = {
	action: 'created' | 'deleted';
	installation: {
		id: number;
		account: { login: string; type: string };
	};
};

type CheckRunPayload = {
	action: 'rerequested';
	check_run: {
		head_sha: string;
		name: string;
		external_id?: string;
	};
	repository: {
		name: string;
		owner: { login: string };
	};
	installation?: { id: number };
};

let githubWebhookHandlersRegistered = false;

export async function handleGithubWebhook(request: Request) {
	const githubApp = getGithubApp();
	if (!githubApp || !isGithubAppConfigured()) {
		return new Response('GitHub App is not configured', { status: 503 });
	}

	ensureGithubWebhookHandlersRegistered(githubApp);

	const payload = await request.text();
	const id = request.headers.get('x-github-delivery') ?? 'unknown';
	const name = request.headers.get('x-github-event') ?? 'unknown';
	const signature = request.headers.get('x-hub-signature-256');
	if (!signature) return new Response('Missing signature', { status: 401 });

	const validSignature = await githubApp.webhooks.verify(payload, signature);
	if (!validSignature) return new Response('Invalid signature', { status: 401 });

	try {
		const event = { id, name, payload: JSON.parse(payload) } as Parameters<
			typeof githubApp.webhooks.receive
		>[0];
		await githubApp.webhooks.receive(event);
	} catch (cause) {
		console.error('GitHub webhook handler failed', cause);
	}

	return new Response('ok');
}

function ensureGithubWebhookHandlersRegistered(
	githubApp: NonNullable<ReturnType<typeof getGithubApp>>
) {
	if (githubWebhookHandlersRegistered) return;
	githubWebhookHandlersRegistered = true;
	registerGithubWebhookHandlers(githubApp);
}

function registerGithubWebhookHandlers(githubApp: NonNullable<ReturnType<typeof getGithubApp>>) {
	githubApp.webhooks.on('installation', async ({ payload }) => {
		const event = payload as InstallationPayload;
		if (event.action === 'created') {
			await upsertGithubInstallation({
				installationId: event.installation.id,
				accountLogin: event.installation.account.login,
				accountType: event.installation.account.type
			});
			return;
		}
		if (event.action === 'deleted') {
			await deleteGithubInstallation(event.installation.id);
		}
	});

	githubApp.webhooks.on('pull_request', async ({ payload }) => {
		const event = payload as PullRequestPayload;
		if (!['opened', 'synchronize', 'reopened'].includes(event.action)) return;
		const installationId = event.installation?.id;
		if (!installationId) return;

		await startGithubRegressionRun({
			installationId,
			repositoryOwner: event.repository.owner.login,
			repositoryName: event.repository.name,
			githubSha: event.pull_request.head.sha,
			githubRef: event.pull_request.head.ref,
			pullRequestNumber: event.number
		});
	});

	githubApp.webhooks.on('check_run', async ({ payload }) => {
		const event = payload as CheckRunPayload;
		if (event.action !== 'rerequested') return;
		if (event.check_run.name !== CHECK_NAME) return;
		const installationId = event.installation?.id;
		if (!installationId) return;

		await startGithubRegressionRun({
			installationId,
			repositoryOwner: event.repository.owner.login,
			repositoryName: event.repository.name,
			githubSha: event.check_run.head_sha,
			forceNewRun: true
		});
	});
}

async function startGithubRegressionRun(input: {
	installationId: number;
	repositoryOwner: string;
	repositoryName: string;
	githubSha: string;
	githubRef?: string;
	pullRequestNumber?: number;
	forceNewRun?: boolean;
}) {
	const created = await createRegressionRunForRepository({
		repositoryOwner: input.repositoryOwner,
		repositoryName: input.repositoryName,
		githubSha: input.githubSha,
		githubRef: input.githubRef,
		pullRequestNumber: input.pullRequestNumber,
		forceNewRun: input.forceNewRun,
		metadata: { installationId: input.installationId, source: 'github' }
	});
	if (!created) return;
	if (!created.isNewRun) return;

	try {
		const checkRunId = await createRegressionCheckRun({
			installationId: input.installationId,
			owner: input.repositoryOwner,
			repo: input.repositoryName,
			headSha: input.githubSha,
			regressionRunPublicId: created.regressionRun.publicId
		});

		if (checkRunId) {
			await db
				.update(regressionRuns)
				.set({
					githubCheckRunId: BigInt(checkRunId),
					metadata: {
						installationId: input.installationId,
						source: 'github'
					},
					updatedAt: new Date()
				})
				.where(eq(regressionRuns.id, created.regressionRun.id));
		}
	} catch (cause) {
		console.error('Failed to create GitHub regression check run', cause);
	}

	scheduleRegressionRun(created.regressionRun.id);
}
