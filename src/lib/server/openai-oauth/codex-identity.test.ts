import { describe, expect, it } from 'vitest';
import { chatgptAccountIdFromAccessToken } from './codex-identity';

function jwt(payload: Record<string, unknown>) {
	const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${header}.${body}.sig`;
}

describe('chatgptAccountIdFromAccessToken', () => {
	it('reads chatgpt_account_id from the access token JWT', () => {
		const token = jwt({
			'https://api.openai.com/auth': { chatgpt_account_id: 'acct_123' }
		});
		expect(chatgptAccountIdFromAccessToken(token)).toBe('acct_123');
	});

	it('returns undefined when the claim is missing', () => {
		expect(chatgptAccountIdFromAccessToken(jwt({ sub: 'user' }))).toBeUndefined();
		expect(chatgptAccountIdFromAccessToken('not-a-jwt')).toBeUndefined();
	});
});
