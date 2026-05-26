import { env } from '$env/dynamic/private';
import { App } from 'octokit';

let app: App | undefined;

function readPrivateKey() {
	const raw = env.GITHUB_APP_PRIVATE_KEY;
	if (!raw) return undefined;
	return raw.includes('\\n') ? raw.replaceAll('\\n', '\n') : raw;
}

export function isGithubAppConfigured() {
	return Boolean(env.GITHUB_APP_ID && readPrivateKey() && env.GITHUB_WEBHOOK_SECRET);
}

export function getGithubApp() {
	if (!isGithubAppConfigured()) return undefined;
	if (!app) {
		app = new App({
			appId: env.GITHUB_APP_ID!,
			privateKey: readPrivateKey()!,
			webhooks: { secret: env.GITHUB_WEBHOOK_SECRET! }
		});
	}
	return app;
}

export async function getInstallationOctokit(installationId: number) {
	const githubApp = getGithubApp();
	if (!githubApp) throw new Error('GitHub App is not configured');
	return githubApp.getInstallationOctokit(installationId);
}

export async function getGithubInstallation(installationId: number) {
	const githubApp = getGithubApp();
	if (!githubApp) throw new Error('GitHub App is not configured');
	const response = await githubApp.octokit.rest.apps.getInstallation({
		installation_id: installationId
	});
	return response.data;
}
