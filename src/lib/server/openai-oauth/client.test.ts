import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_TOKEN_URL } from './constants';
import { isDevicePollPendingHttpStatus, pollDeviceCodeToken } from './client';

const originalFetch = globalThis.fetch;

describe('isDevicePollPendingHttpStatus', () => {
	it('treats Codex pending statuses as not ready', () => {
		expect(isDevicePollPendingHttpStatus(403)).toBe(true);
		expect(isDevicePollPendingHttpStatus(404)).toBe(true);
		expect(isDevicePollPendingHttpStatus(428)).toBe(true);
		expect(isDevicePollPendingHttpStatus(400)).toBe(false);
		expect(isDevicePollPendingHttpStatus(200)).toBe(false);
	});
});

describe('pollDeviceCodeToken', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('returns pending on HTTP 403 while user is authorizing', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
		globalThis.fetch = fetchMock;

		const result = await pollDeviceCodeToken({
			deviceAuthId: 'device-123',
			userCode: 'ABCD-EFGH'
		});

		expect(result).toEqual({ pending: true });
		expect(fetchMock).toHaveBeenCalledWith(
			DEVICE_TOKEN_URL,
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns tokens when authorization completes', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					authorization_code: 'auth-code',
					code_verifier: 'verifier',
					code_challenge: 'challenge'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		);

		const result = await pollDeviceCodeToken({
			deviceAuthId: 'device-123',
			userCode: 'ABCD-EFGH'
		});

		expect(result.pending).toBe(false);
		if (!result.pending) {
			expect(result.payload.authorization_code).toBe('auth-code');
		}
	});
});
