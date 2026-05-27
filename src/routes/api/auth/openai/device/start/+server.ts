import { requireUserId } from '$lib/server/auth';
import { ok, parseJson } from '$lib/server/http';
import {
	DEVICE_CODE_DEFAULT_POLL_MS,
	deviceVerificationUri,
	readOpenAIOAuthConfig,
	startDeviceCodeFlow
} from '$lib/server/openai-oauth';
import { createDeviceConnectState } from '$lib/server/openai-oauth/connect-state';
import { chatgptOAuthConnectSchema } from '$lib/server/validation';

export async function POST(event) {
	const userId = requireUserId(event);
	const input = await parseJson(event, chatgptOAuthConnectSchema);
	const config = readOpenAIOAuthConfig(event.url.origin);
	const device = await startDeviceCodeFlow(config.clientId);
	if (!device.device_auth_id || !device.user_code) {
		throw new Error('Device code response missing device_auth_id or user_code');
	}

	const deviceCodeDefaultPollSeconds = DEVICE_CODE_DEFAULT_POLL_MS / 1000;
	const pollIntervalMs = (device.interval ?? deviceCodeDefaultPollSeconds) * 1000;
	await createDeviceConnectState({
		ownerUserId: userId,
		label: input.label,
		deviceAuthId: device.device_auth_id,
		userCode: device.user_code,
		pollIntervalMs
	});

	return ok({
		flow: 'device' as const,
		deviceAuthId: device.device_auth_id,
		userCode: device.user_code,
		verificationUri: device.verification_uri ?? deviceVerificationUri(),
		pollIntervalMs
	});
}
