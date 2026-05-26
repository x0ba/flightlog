import type { evaluationPolicySchema } from '$lib/server/validation';
import type { z } from 'zod';

export type EvaluationPolicy = z.infer<typeof evaluationPolicySchema>;

export const defaultEvaluationPolicy: EvaluationPolicy = {
	minScore: 70,
	allowConstraintViolations: false,
	allowErrorFindings: false
};

export function parsePolicy(value: unknown): EvaluationPolicy {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultEvaluationPolicy;
	const policy = value as Partial<EvaluationPolicy>;
	return {
		minScore:
			typeof policy.minScore === 'number' ? policy.minScore : defaultEvaluationPolicy.minScore,
		allowConstraintViolations:
			typeof policy.allowConstraintViolations === 'boolean'
				? policy.allowConstraintViolations
				: defaultEvaluationPolicy.allowConstraintViolations,
		allowErrorFindings:
			typeof policy.allowErrorFindings === 'boolean'
				? policy.allowErrorFindings
				: defaultEvaluationPolicy.allowErrorFindings
	};
}

export function parseConstraints(value: unknown) {
	if (!Array.isArray(value)) return [] as string[];
	return value.filter((item): item is string => typeof item === 'string');
}

export type CaseEvaluationInput = {
	score: number | null;
	violatedConstraints: boolean | null;
	goalCompleted: boolean | null;
	findings: Array<{ severity: 'info' | 'warning' | 'error' }>;
	caseMinScore?: number;
};

export function resolveMinScore(policy: EvaluationPolicy, caseMinScore?: number) {
	return caseMinScore ?? policy.minScore;
}

export function evaluateCaseResult(input: CaseEvaluationInput, policy: EvaluationPolicy) {
	const minScore = resolveMinScore(policy, input.caseMinScore);
	const score = input.score ?? 0;

	if (input.goalCompleted === false) {
		return { passed: false, reason: 'Agent did not complete the goal.' };
	}
	if (input.goalCompleted !== true) {
		return { passed: false, reason: 'Goal completion was not determined.' };
	}
	if (!policy.allowConstraintViolations && input.violatedConstraints) {
		return { passed: false, reason: 'Agent violated one or more constraints.' };
	}
	if (
		!policy.allowErrorFindings &&
		input.findings.some((finding) => finding.severity === 'error')
	) {
		return { passed: false, reason: 'Evaluation reported error-severity findings.' };
	}
	if (score < minScore) {
		return {
			passed: false,
			reason: `Score ${score} is below the minimum threshold of ${minScore}.`
		};
	}

	return { passed: true, reason: undefined };
}

export function aggregateSuiteResult(
	caseResults: Array<{ passed: boolean | null; score: number | null }>
) {
	const completed = caseResults.filter((result) => result.passed !== null);
	if (!completed.length) {
		return { passed: false, aggregateScore: null, summary: 'No regression cases completed.' };
	}

	const passed = completed.every((result) => result.passed);
	const scores = completed
		.map((result) => result.score)
		.filter((score): score is number => score !== null);
	const aggregateScore = scores.length
		? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
		: null;
	const failedCount = completed.filter((result) => !result.passed).length;

	return {
		passed,
		aggregateScore,
		summary: passed
			? `All ${completed.length} regression case(s) passed.`
			: `${failedCount} of ${completed.length} regression case(s) failed.`
	};
}
