import { error, json, type RequestEvent } from '@sveltejs/kit';
import { findRunForUser } from '$lib/server/runs';
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

export function conflict(message = 'Conflict'): never {
	throw error(409, { message });
}

export async function requireRunForUser(publicRunId: string, ownerUserId: string, message: string) {
	const run = await findRunForUser(publicRunId, ownerUserId);
	if (!run) notFound(message);
	return run;
}
