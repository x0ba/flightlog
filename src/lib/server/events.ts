import { and, asc, eq, max } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events, spans } from '$lib/server/db/schema';
import { publicId } from '$lib/server/public-id';
import type { appendEventSchema } from '$lib/server/validation';
import type { z } from 'zod';

type EventInput = z.infer<typeof appendEventSchema>;

export async function appendEvent(runId: number, input: EventInput) {
	const span = input.spanId
		? await db
				.select({ id: spans.id })
				.from(spans)
				.where(and(eq(spans.publicId, input.spanId), eq(spans.runId, runId)))
				.limit(1)
		: [];
	const [{ currentSequence }] = await db
		.select({ currentSequence: max(events.sequence) })
		.from(events)
		.where(eq(events.runId, runId));
	const sequence = (currentSequence ?? 0) + 1;
	const [event] = await db
		.insert(events)
		.values({
			publicId: publicId('evt'),
			runId,
			spanId: span[0]?.id,
			sequence,
			type: input.type,
			title: input.title,
			message: input.message,
			data: input.data,
			status: input.status,
			occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined
		})
		.returning();

	return event;
}

export async function appendEvents(runId: number, inputs: EventInput[]) {
	const appended = [];
	for (const input of inputs) {
		appended.push(await appendEvent(runId, input));
	}
	return appended;
}

export async function listEvents(runId: number) {
	return db.select().from(events).where(eq(events.runId, runId)).orderBy(asc(events.sequence));
}
