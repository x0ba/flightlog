import { createHash, randomBytes } from 'node:crypto';

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function generateCodeVerifier(length = 64) {
	if (length < 43 || length > 128) {
		throw new Error('code verifier length must be between 43 and 128');
	}
	const bytes = randomBytes(length);
	let verifier = '';
	for (let index = 0; index < length; index += 1) {
		verifier += UNRESERVED[bytes[index]! % UNRESERVED.length];
	}
	return verifier;
}

export function generateCodeChallenge(verifier: string) {
	const digest = createHash('sha256').update(verifier, 'ascii').digest();
	return digest.toString('base64url');
}

export function generateOAuthState() {
	return randomBytes(32).toString('base64url');
}
