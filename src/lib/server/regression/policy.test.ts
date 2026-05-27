import { describe, expect, it } from 'vitest';
import {
	aggregateSuiteResult,
	defaultEvaluationPolicy,
	evaluateCaseResult,
	parseConstraints,
	parsePolicy,
	resolveMinScore
} from './policy';

describe('parsePolicy', () => {
	it('returns defaults for invalid input', () => {
		expect(parsePolicy(null)).toEqual(defaultEvaluationPolicy);
		expect(parsePolicy([])).toEqual(defaultEvaluationPolicy);
	});

	it('merges partial policy values', () => {
		expect(parsePolicy({ minScore: 90, allowErrorFindings: true })).toEqual({
			minScore: 90,
			allowConstraintViolations: false,
			allowErrorFindings: true
		});
	});
});

describe('parseConstraints', () => {
	it('returns an empty array for non-array input', () => {
		expect(parseConstraints(undefined)).toEqual([]);
	});

	it('filters non-string entries', () => {
		expect(parseConstraints(['stay on site', 42, null, 'no payments'])).toEqual([
			'stay on site',
			'no payments'
		]);
	});
});

describe('resolveMinScore', () => {
	it('prefers case min score when provided', () => {
		expect(resolveMinScore(defaultEvaluationPolicy, 85)).toBe(85);
	});

	it('falls back to policy min score', () => {
		expect(resolveMinScore(defaultEvaluationPolicy)).toBe(defaultEvaluationPolicy.minScore);
	});
});

describe('evaluateCaseResult', () => {
	const passingInput = {
		score: 90,
		violatedConstraints: false,
		goalCompleted: true,
		findings: [] as Array<{ severity: 'info' | 'warning' | 'error' }>
	};

	it('passes when all criteria are met', () => {
		expect(evaluateCaseResult(passingInput, defaultEvaluationPolicy)).toEqual({
			passed: true,
			reason: undefined
		});
	});

	it('fails when the goal was not completed', () => {
		expect(
			evaluateCaseResult({ ...passingInput, goalCompleted: false }, defaultEvaluationPolicy)
		).toEqual({
			passed: false,
			reason: 'Agent did not complete the goal.'
		});
	});

	it('fails when goal completion is unknown', () => {
		expect(
			evaluateCaseResult({ ...passingInput, goalCompleted: null }, defaultEvaluationPolicy)
		).toEqual({
			passed: false,
			reason: 'Goal completion was not determined.'
		});
	});

	it('fails on constraint violations when not allowed', () => {
		expect(
			evaluateCaseResult({ ...passingInput, violatedConstraints: true }, defaultEvaluationPolicy)
		).toEqual({
			passed: false,
			reason: 'Agent violated one or more constraints.'
		});
	});

	it('fails on error findings when not allowed', () => {
		expect(
			evaluateCaseResult(
				{ ...passingInput, findings: [{ severity: 'error' }] },
				defaultEvaluationPolicy
			)
		).toEqual({
			passed: false,
			reason: 'Evaluation reported error-severity findings.'
		});
	});

	it('fails when score is missing', () => {
		expect(evaluateCaseResult({ ...passingInput, score: null }, defaultEvaluationPolicy)).toEqual({
			passed: false,
			reason: 'Evaluation did not produce a score.'
		});
	});

	it('fails when score is below threshold', () => {
		expect(
			evaluateCaseResult({ ...passingInput, score: 50, caseMinScore: 70 }, defaultEvaluationPolicy)
		).toEqual({
			passed: false,
			reason: 'Score 50 is below the minimum threshold of 70.'
		});
	});
});

describe('aggregateSuiteResult', () => {
	it('reports incomplete cases', () => {
		expect(
			aggregateSuiteResult([
				{ passed: true, score: 90, status: 'completed' },
				{ passed: null, score: null, status: 'running' }
			])
		).toEqual({
			passed: false,
			aggregateScore: null,
			summary: '1 regression case(s) did not complete.'
		});
	});

	it('aggregates pass/fail and average score', () => {
		expect(
			aggregateSuiteResult([
				{ passed: true, score: 80, status: 'completed' },
				{ passed: false, score: 60, status: 'completed' }
			])
		).toEqual({
			passed: false,
			aggregateScore: 70,
			summary: '1 of 2 regression case(s) failed.'
		});
	});

	it('passes when every completed case passed', () => {
		expect(
			aggregateSuiteResult([
				{ passed: true, score: 90, status: 'completed' },
				{ passed: true, score: 70, status: 'completed' }
			])
		).toEqual({
			passed: true,
			aggregateScore: 80,
			summary: 'All 2 regression case(s) passed.'
		});
	});
});
