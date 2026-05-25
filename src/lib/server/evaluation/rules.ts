import type { events } from '$lib/server/db/schema';
import type { EvaluationFindingInput } from './types';

type EventRow = typeof events.$inferSelect;

function textIncludes(value: unknown, pattern: RegExp) {
	return (
		JSON.stringify(value ?? '')
			.toLowerCase()
			.match(pattern) !== null
	);
}

function actionSignature(event: EventRow) {
	const data = event.data as Record<string, unknown> | null;
	if (!data) return `${event.type}:${event.message ?? ''}`;
	const tool = data.tool ?? data.action ?? data.name ?? event.type;
	const input = data.input ?? data.selector ?? data.url ?? data.target ?? '';
	return `${event.type}:${String(tool)}:${JSON.stringify(input)}`;
}

export function evaluateRules(eventsList: EventRow[]) {
	const findings: EvaluationFindingInput[] = [];
	const neededHumanApproval = eventsList.some(
		(event) =>
			event.type === 'human_approval' || textIncludes(event.data, /approval|approved|human/)
	);
	const violatedConstraints = eventsList.some(
		(event) =>
			(event.type === 'constraint' && event.status === 'failed') ||
			textIncludes([event.message, event.data], /constraint.*(violate|fail)|violate.*constraint/)
	);
	const toolFailures = eventsList.filter(
		(event) =>
			event.type === 'error' ||
			(event.type === 'tool_result' && event.status === 'failed') ||
			textIncludes(event.data, /"success":false|failed|error/)
	);

	const repeatedSignatures = new Map<string, number>();
	for (const event of eventsList.filter((item) =>
		['tool_call', 'browser_action', 'planned_action'].includes(item.type)
	)) {
		const signature = actionSignature(event);
		repeatedSignatures.set(signature, (repeatedSignatures.get(signature) ?? 0) + 1);
	}
	const repeatedActions = [...repeatedSignatures.values()].some((count) => count >= 3);

	if (neededHumanApproval) {
		findings.push({
			severity: 'info',
			category: 'human_approval',
			message: 'The run included a human approval step.'
		});
	}
	if (violatedConstraints) {
		findings.push({
			severity: 'error',
			category: 'constraint_violation',
			message: 'A logged event indicates a constraint violation.'
		});
	}
	if (repeatedActions) {
		findings.push({
			severity: 'warning',
			category: 'repetition',
			message: 'The run repeated the same action signature at least three times.'
		});
	}
	if (toolFailures.length) {
		findings.push({
			severity: 'warning',
			category: 'tool_failure',
			message: `${toolFailures.length} tool or runtime failure event${toolFailures.length === 1 ? '' : 's'} occurred.`
		});
	}

	return {
		neededHumanApproval,
		violatedConstraints,
		repeatedActions,
		toolFailureCount: toolFailures.length,
		findings
	};
}
