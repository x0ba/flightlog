import { describe, expect, it } from 'vitest';
import type { events } from '$lib/server/db/schema';
import { evaluateRules } from './rules';

type EventRow = typeof events.$inferSelect;

function event(partial: Partial<EventRow> & Pick<EventRow, 'type'>): EventRow {
	return {
		id: 1,
		publicId: 'evt_test',
		runId: 1,
		spanId: null,
		sequence: 1,
		title: null,
		message: null,
		data: null,
		status: null,
		occurredAt: new Date(),
		createdAt: new Date(),
		...partial
	};
}

describe('evaluateRules', () => {
	it('returns no findings for a clean run', () => {
		const result = evaluateRules([
			event({ type: 'goal', message: 'Complete checkout' }),
			event({ type: 'observation', message: 'Done' })
		]);

		expect(result.neededHumanApproval).toBe(false);
		expect(result.violatedConstraints).toBe(false);
		expect(result.repeatedActions).toBe(false);
		expect(result.toolFailureCount).toBe(0);
		expect(result.findings).toEqual([]);
	});

	it('detects human approval events', () => {
		const result = evaluateRules([event({ type: 'human_approval', data: { approved: true } })]);

		expect(result.neededHumanApproval).toBe(true);
		expect(result.findings).toContainEqual(
			expect.objectContaining({ category: 'human_approval', severity: 'info' })
		);
	});

	it('detects constraint violations from failed constraint events', () => {
		const result = evaluateRules([
			event({ type: 'constraint', status: 'failed', message: 'Blocked navigation' })
		]);

		expect(result.violatedConstraints).toBe(true);
		expect(result.findings).toContainEqual(
			expect.objectContaining({ category: 'constraint_violation', severity: 'error' })
		);
	});

	it('detects repeated action signatures', () => {
		const repeated = event({
			type: 'tool_call',
			data: { tool: 'search', input: { query: 'flights' } }
		});
		const result = evaluateRules([repeated, repeated, repeated]);

		expect(result.repeatedActions).toBe(true);
		expect(result.findings).toContainEqual(
			expect.objectContaining({ category: 'repetition', severity: 'warning' })
		);
	});

	it('counts tool and runtime failures', () => {
		const result = evaluateRules([
			event({ type: 'error', message: 'Timeout' }),
			event({ type: 'tool_result', status: 'failed', data: { success: false } })
		]);

		expect(result.toolFailureCount).toBe(2);
		expect(result.findings).toContainEqual(
			expect.objectContaining({ category: 'tool_failure', severity: 'warning' })
		);
	});
});
