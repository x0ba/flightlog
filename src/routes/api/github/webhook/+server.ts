import { handleGithubWebhook } from '$lib/server/github/webhooks';

export async function POST(event) {
	return handleGithubWebhook(event.request);
}
