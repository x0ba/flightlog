export type OpenAIOAuthFlowConfig = {
	redirectUriFromEnv: boolean;
	deviceAuth: 'auto' | 'on' | 'off';
};

/** Device flow is required for the public Codex client unless a redirect URI is registered in env. */
export function shouldUseDeviceAuth(config: OpenAIOAuthFlowConfig) {
	if (config.deviceAuth === 'on') return true;
	if (config.deviceAuth === 'off') return false;
	return !config.redirectUriFromEnv;
}
