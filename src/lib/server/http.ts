import { error, json, type RequestEvent } from '@sveltejs/kit';
import { ZodError, type ZodType } from 'zod';

export async function parseJson<T>(event: RequestEvent, schema: ZodType<T>) {
	try {
		return schema.parse(await event.request.json());
	} catch (cause) {
		if (cause instanceof ZodError) {
			throw error(400, { message: cause.issues.map((issue) => issue.message).join(', ') });
		}
		throw error(400, { message: 'Invalid JSON body' });
	}
}

export function ok<T>(body: T, init?: ResponseInit) {
	return json(body, init);
}

export function notFound(message = 'Not found'): never {
	throw error(404, { message });
}
