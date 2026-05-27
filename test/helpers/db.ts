import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createRun } from '$lib/server/runs';

export async function resetDatabase() {
	await db.execute(sql`
		truncate table
			evaluation_findings,
			evaluations,
			artifacts,
			events,
			spans,
			regression_case_runs,
			regression_runs,
			regression_cases,
			regression_suites,
			provider_credentials,
			github_installations,
			runs
		restart identity cascade
	`);
}

export async function seedRun(input: { goal?: string; ownerUserId?: string } = {}) {
	return createRun({
		ownerUserId: input.ownerUserId ?? 'user_test',
		goal: input.goal ?? 'Complete the test goal'
	});
}
