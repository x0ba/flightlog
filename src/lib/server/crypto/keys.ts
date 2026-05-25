import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

const VERSION = 'flk1';
const ALGORITHM = 'aes-256-gcm';

export function encryptSecret(value: string) {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGORITHM, key(), iv);
	const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [
		VERSION,
		iv.toString('base64url'),
		tag.toString('base64url'),
		ciphertext.toString('base64url')
	].join('.');
}

export function decryptSecret(payload: string) {
	const [version, iv, tag, ciphertext] = payload.split('.');
	if (version !== VERSION || !iv || !tag || !ciphertext) {
		throw new Error('Unsupported encrypted secret format');
	}
	const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64url'));
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	return Buffer.concat([
		decipher.update(Buffer.from(ciphertext, 'base64url')),
		decipher.final()
	]).toString('utf8');
}

function key() {
	if (!env.FLIGHTLOG_KEYS_SECRET) {
		throw new Error('FLIGHTLOG_KEYS_SECRET is required for dashboard provider keys');
	}
	return createHash('sha256').update(env.FLIGHTLOG_KEYS_SECRET).digest();
}
