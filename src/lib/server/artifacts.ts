import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artifacts, events } from '$lib/server/db/schema';
import { publicId } from '$lib/server/public-id';
import type { createArtifactSchema } from '$lib/server/validation';
import type { z } from 'zod';

type ArtifactInput = z.infer<typeof createArtifactSchema>;

export async function createArtifact(runId: number, input: ArtifactInput) {
	const event = input.eventId
		? (
				await db
					.select({ id: events.id })
					.from(events)
					.where(and(eq(events.publicId, input.eventId), eq(events.runId, runId)))
					.limit(1)
			)[0]
		: undefined;

	const [artifact] = await db
		.insert(artifacts)
		.values({
			publicId: publicId('art'),
			runId,
			eventId: event?.id,
			type: input.type,
			name: input.name,
			mimeType: input.mimeType,
			url: input.url,
			content: input.content,
			metadata: input.metadata
		})
		.returning();

	return artifact;
}

export async function listArtifacts(runId: number) {
	return db
		.select()
		.from(artifacts)
		.where(eq(artifacts.runId, runId))
		.orderBy(asc(artifacts.createdAt));
}
