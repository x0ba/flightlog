import { env } from '$env/dynamic/private';
import type { ApprovalDecision, ComputerAction, PendingApproval, SafetyCheck } from './types';

type PendingApprovalState = {
	approval: PendingApproval;
	resolve: (decision: ApprovalDecision) => void;
	timeout: ReturnType<typeof setTimeout>;
};

const approvalsByRun = new Map<string, PendingApprovalState>();

function approvalTimeoutMs() {
	const seconds = Number(env.FLIGHTLOG_AGENT_APPROVAL_TIMEOUT_SECONDS ?? 300);
	return Math.max(1, Number.isFinite(seconds) ? seconds : 300) * 1000;
}

export function needsApproval(action: ComputerAction, safetyChecks: SafetyCheck[] = []) {
	if (safetyChecks.length) return true;
	if (
		action.type === 'type' &&
		/password|card|cc-|cvv|cvc|ssn|social security/i.test(action.text)
	) {
		return true;
	}
	if (action.type === 'keypress') {
		return action.keys.some((key) => /enter|return/i.test(key));
	}
	if (action.type === 'click' || action.type === 'double_click') return false;
	return false;
}

export function waitForApproval(publicRunId: string, approval: PendingApproval) {
	return new Promise<ApprovalDecision>((resolve) => {
		const previous = approvalsByRun.get(publicRunId);
		if (previous) clearTimeout(previous.timeout);

		const timeout = setTimeout(() => {
			approvalsByRun.delete(publicRunId);
			resolve({
				approvalId: approval.id,
				decision: 'rejected',
				note: 'Approval timed out.'
			});
		}, approvalTimeoutMs());

		approvalsByRun.set(publicRunId, { approval, resolve, timeout });
	});
}

export function resolveApproval(publicRunId: string, decision: ApprovalDecision) {
	const pending = approvalsByRun.get(publicRunId);
	if (!pending || pending.approval.id !== decision.approvalId) return false;
	clearTimeout(pending.timeout);
	approvalsByRun.delete(publicRunId);
	pending.resolve(decision);
	return true;
}
