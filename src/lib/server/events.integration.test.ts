import { beforeEach, describe, expect, it } from 'vitest';
import { appendEvent, appendEvents, listEvents } from '$lib/server/events';
import { resetDatabase, seedRun } from '../../../test/helpers/db';

describe('events integration', () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	it('assigns monotonic sequence numbers', async () => {
		const run = await seedRun();
		const first = await appendEvent(run.id, { type: 'goal', message: 'Start' });
		const second = await appendEvent(run.id, { type: 'observation', message: 'Step 1' });
		const third = await appendEvent(run.id, { type: 'observation', message: 'Step 2' });

		expect(first.sequence).toBe(1);
		expect(second.sequence).toBe(2);
		expect(third.sequence).toBe(3);
	});

	it('preserves order when appending batches', async () => {
		const run = await seedRun();
		const appended = await appendEvents(run.id, [
			{ type: 'goal', message: 'Batch goal' },
			{ type: 'plan', message: 'Batch plan' },
			{ type: 'final_result', message: 'Done' }
		]);

		expect(appended.map((event) => event.sequence)).toEqual([1, 2, 3]);
		expect(appended.map((event) => event.type)).toEqual(['goal', 'plan', 'final_result']);
	});

	it('lists events in ascending sequence order', async () => {
		const run = await seedRun();
		await appendEvents(run.id, [
			{ type: 'goal', message: 'One' },
			{ type: 'plan', message: 'Two' },
			{ type: 'observation', message: 'Three' }
		]);

		const events = await listEvents(run.id);
		expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
	});
});
