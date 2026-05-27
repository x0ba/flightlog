import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { needsApproval, resolveApproval, waitForApproval } from './approval';

describe('needsApproval', () => {
	it('requires approval when safety checks are present', () => {
		expect(
			needsApproval({ type: 'click', x: 1, y: 2 }, [{ id: '1', code: 'safety', message: 'Check' }])
		).toBe(true);
	});

	it('requires approval for sensitive typed text', () => {
		expect(needsApproval({ type: 'type', text: 'Enter your password here' })).toBe(true);
	});

	it('requires approval for enter keypresses', () => {
		expect(needsApproval({ type: 'keypress', keys: ['Enter'] })).toBe(true);
	});

	it('does not require approval for ordinary clicks', () => {
		expect(needsApproval({ type: 'click', x: 10, y: 20 })).toBe(false);
	});

	it('does not require approval for scroll actions', () => {
		expect(needsApproval({ type: 'scroll', scroll_y: 100 })).toBe(false);
	});
});

describe('waitForApproval and resolveApproval', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves with an approved decision', async () => {
		const approval = {
			id: 'appr_1',
			callId: 'call_1',
			safetyChecks: [],
			action: { type: 'click', x: 1, y: 2 },
			createdAt: new Date().toISOString()
		};
		const pending = waitForApproval('run_1', approval);

		expect(resolveApproval('run_1', { approvalId: 'appr_1', decision: 'approved' })).toBe(true);
		await expect(pending).resolves.toEqual({
			approvalId: 'appr_1',
			decision: 'approved'
		});
	});

	it('rejects on timeout', async () => {
		const approval = {
			id: 'appr_2',
			callId: 'call_2',
			safetyChecks: [],
			action: { type: 'type', text: 'hello' },
			createdAt: new Date().toISOString()
		};
		const pending = waitForApproval('run_2', approval);

		await vi.advanceTimersByTimeAsync(300_000);
		await expect(pending).resolves.toEqual({
			approvalId: 'appr_2',
			decision: 'rejected',
			note: 'Approval timed out.'
		});
	});

	it('returns false when resolving an unknown approval', () => {
		expect(resolveApproval('run_missing', { approvalId: 'nope', decision: 'approved' })).toBe(
			false
		);
	});
});
