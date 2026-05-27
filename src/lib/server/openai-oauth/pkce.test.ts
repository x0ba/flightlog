import { describe, expect, it } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';

describe('openai-oauth pkce', () => {
	it('generates verifier within RFC length bounds', () => {
		const verifier = generateCodeVerifier();
		expect(verifier.length).toBeGreaterThanOrEqual(43);
		expect(verifier.length).toBeLessThanOrEqual(128);
	});

	it('produces stable S256 challenge', () => {
		const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';
		const challenge = generateCodeChallenge(verifier);
		expect(challenge).toBe('ImpiCd8pp4MveCNnbIS7-GXEtB0xF5HMIDoWqvGA5ig');
		expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(challenge).not.toContain('=');
		expect(generateCodeChallenge(verifier)).toBe(challenge);
	});
});
