import { describe, expect, it } from 'vitest';
import { isProtectedPath, isPublicApiPath, readUserId } from './auth';

describe('readUserId', () => {
	it('prefers cookie session user id over bearer token', () => {
		const event = {
			locals: {
				auth: { user: { id: 'user_session' } },
				bearerUserId: 'user_bearer'
			}
		} as Parameters<typeof readUserId>[0];

		expect(readUserId(event)).toBe('user_session');
	});

	it('falls back to bearer user id when no cookie session', () => {
		const event = {
			locals: {
				auth: { user: null },
				bearerUserId: 'user_bearer'
			}
		} as Parameters<typeof readUserId>[0];

		expect(readUserId(event)).toBe('user_bearer');
	});

	it('returns undefined when unauthenticated', () => {
		const event = {
			locals: {
				auth: { user: null }
			}
		} as Parameters<typeof readUserId>[0];

		expect(readUserId(event)).toBeUndefined();
	});
});

describe('isProtectedPath', () => {
	it('protects dashboard and API routes', () => {
		expect(isProtectedPath('/runs')).toBe(true);
		expect(isProtectedPath('/runs/run_123')).toBe(true);
		expect(isProtectedPath('/regression')).toBe(true);
		expect(isProtectedPath('/regression/suite_123')).toBe(true);
		expect(isProtectedPath('/api/runs')).toBe(true);
		expect(isProtectedPath('/api/v1/traces/trace_123/events')).toBe(true);
		expect(isProtectedPath('/api/settings/providers')).toBe(true);
	});

	it('does not protect public pages', () => {
		expect(isProtectedPath('/')).toBe(false);
		expect(isProtectedPath('/sign-in')).toBe(false);
	});
});

describe('isPublicApiPath', () => {
	it('allows the GitHub webhook endpoint', () => {
		expect(isPublicApiPath('/api/github/webhook')).toBe(true);
	});

	it('does not mark other API routes as public', () => {
		expect(isPublicApiPath('/api/runs')).toBe(false);
	});
});
