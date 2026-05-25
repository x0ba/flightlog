import { randomUUID } from 'node:crypto';

type PublicIdPrefix = 'run' | 'evt' | 'art' | 'eval';

export function publicId(prefix: PublicIdPrefix) {
	return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
}
