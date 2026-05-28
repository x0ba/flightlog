import { describe, expect, it } from 'vitest';
import { shouldUseDeviceAuth, type OpenAIOAuthFlowConfig } from './device-auth-policy';

function config(overrides: Partial<OpenAIOAuthFlowConfig>): OpenAIOAuthFlowConfig {
	return {
		redirectUriFromEnv: false,
		deviceAuth: 'auto',
		...overrides
	};
}

describe('shouldUseDeviceAuth', () => {
	it('prefers device flow in auto mode without a registered redirect URI', () => {
		expect(shouldUseDeviceAuth(config({ redirectUriFromEnv: false, deviceAuth: 'auto' }))).toBe(
			true
		);
	});

	it('allows redirect flow in auto mode when redirect URI is configured in env', () => {
		expect(shouldUseDeviceAuth(config({ redirectUriFromEnv: true, deviceAuth: 'auto' }))).toBe(
			false
		);
	});

	it('honors explicit device auth mode overrides', () => {
		expect(shouldUseDeviceAuth(config({ deviceAuth: 'on', redirectUriFromEnv: true }))).toBe(true);
		expect(shouldUseDeviceAuth(config({ deviceAuth: 'off', redirectUriFromEnv: false }))).toBe(
			false
		);
	});
});
