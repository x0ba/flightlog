import { describe, expect, it } from 'vitest';
import { readPostAuthRedirectUrl, safeRedirectPath } from './auth-redirect';

describe('safeRedirectPath', () => {
	it('returns local paths unchanged', () => {
		expect(safeRedirectPath('/runs')).toBe('/runs');
		expect(safeRedirectPath('/regression/suite_123')).toBe('/regression/suite_123');
	});

	it('rejects external and malformed targets', () => {
		expect(safeRedirectPath('https://evil.test/runs')).toBe('/runs');
		expect(safeRedirectPath('//evil.test/runs')).toBe('/runs');
		expect(safeRedirectPath(null)).toBe('/runs');
	});
});

describe('readPostAuthRedirectUrl', () => {
	it('prefers redirect_url and supports redirectUrl', () => {
		expect(readPostAuthRedirectUrl(new URLSearchParams('redirect_url=/runs'))).toBe('/runs');
		expect(readPostAuthRedirectUrl(new URLSearchParams('redirectUrl=/regression'))).toBe(
			'/regression'
		);
	});

	it('falls back when params are missing or unsafe', () => {
		expect(readPostAuthRedirectUrl(new URLSearchParams())).toBe('/runs');
		expect(readPostAuthRedirectUrl(new URLSearchParams('redirect_url=https://evil.test'))).toBe(
			'/runs'
		);
	});
});
