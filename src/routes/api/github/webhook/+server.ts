import { handleGithubWebhook } from '$lib/server/github/webhooks';

/** @type {import('@sveltejs/adapter-vercel').Config} */
export const config = {
	maxDuration: 60
};

export async function POST(event) {
	return handleGithubWebhook(event.request);
}
