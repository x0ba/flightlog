import { describe, expect, it } from 'vitest';
import { isProtectedPath, isPublicApiPath } from './auth';

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
