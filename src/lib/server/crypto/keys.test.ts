import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './keys';

describe('encryptSecret and decryptSecret', () => {
	it('round-trips a secret value', () => {
		const encrypted = encryptSecret('sk-test-provider-key');
		expect(encrypted.startsWith('flk1.')).toBe(true);
		expect(decryptSecret(encrypted)).toBe('sk-test-provider-key');
	});

	it('throws for malformed payloads', () => {
		expect(() => decryptSecret('bad-payload')).toThrow('Unsupported encrypted secret format');
	});
});
