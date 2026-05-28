import { env } from '$env/dynamic/private';
import { DEFAULT_CODEX_CLIENT_ID, DEVICE_VERIFICATION_URL } from './constants';
export { shouldUseDeviceAuth } from './device-auth-policy';

export type OpenAIOAuthConfig = {
	clientId: string;
	redirectUri: string | undefined;
	/** True when OPENAI_OAUTH_REDIRECT_URI is set (registered with OpenAI for redirect flow). */
	redirectUriFromEnv: boolean;
	deviceAuth: 'auto' | 'on' | 'off';
};

export function readOpenAIOAuthConfig(origin?: string): OpenAIOAuthConfig {
	const redirectUriFromEnv = Boolean(env.OPENAI_OAUTH_REDIRECT_URI?.trim());
	const clientId = env.OPENAI_OAUTH_CLIENT_ID?.trim() || DEFAULT_CODEX_CLIENT_ID;
	const redirectUri =
		env.OPENAI_OAUTH_REDIRECT_URI?.trim() ||
		(origin ? `${origin.replace(/\/$/, '')}/api/auth/openai/callback` : undefined);
	const deviceAuth = parseDeviceAuthMode(env.OPENAI_OAUTH_DEVICE_AUTH);
	return { clientId, redirectUri, redirectUriFromEnv, deviceAuth };
}

export function deviceVerificationUri() {
	return DEVICE_VERIFICATION_URL;
}

function parseDeviceAuthMode(value: string | undefined): OpenAIOAuthConfig['deviceAuth'] {
	if (value === 'on' || value === 'off' || value === 'auto') return value;
	return 'auto';
}
