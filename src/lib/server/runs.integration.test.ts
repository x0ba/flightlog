import { beforeEach, describe, expect, it } from 'vitest';
import { createRun, findRunForUser } from '$lib/server/runs';
import { resetDatabase } from '../../../test/helpers/db';

describe('runs integration', () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	it('scopes runs to the owning user', async () => {
		const run = await createRun({
			ownerUserId: 'user_owner',
			goal: 'Owner-only run'
		});

		expect(await findRunForUser(run.publicId, 'user_owner')).toMatchObject({
			publicId: run.publicId,
			goal: 'Owner-only run'
		});
		expect(await findRunForUser(run.publicId, 'user_other')).toBeUndefined();
	});
});
