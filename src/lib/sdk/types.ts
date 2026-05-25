export type RunStatus = 'running' | 'success' | 'failed' | 'cancelled';
export type EventType =
	| 'goal'
	| 'plan'
	| 'planned_action'
	| 'tool_call'
	| 'tool_result'
	| 'browser_action'
	| 'observation'
	| 'reasoning_summary'
	| 'human_approval'
	| 'constraint'
	| 'error'
	| 'final_result'
	| 'goal.set'
	| 'plan.created'
	| 'model_call.requested'
	| 'model_call.started'
	| 'model_call.completed'
	| 'model_call.failed'
	| 'tool_call.requested'
	| 'tool_call.started'
	| 'tool_call.completed'
	| 'tool_call.failed'
	| 'browser_action.requested'
	| 'browser_action.started'
	| 'browser_action.completed'
	| 'browser_action.failed'
	| 'observation.created'
	| 'reasoning_summary.created'
	| 'approval.requested'
	| 'approval.resolved'
	| 'constraint.checked'
	| 'artifact.attached'
	| 'evaluation.created'
	| 'evaluation.completed'
	| 'trace.completed'
	| 'trace.failed';
export type EventStatus = 'pending' | 'success' | 'failed' | 'skipped';
export type ArtifactType = 'screenshot' | 'dom_snapshot' | 'html' | 'text' | 'json' | 'log';
export type TraceSchemaVersion = 'flightlog.trace.v1';
export type SpanKind =
	| 'agent'
	| 'model_call'
	| 'tool_call'
	| 'browser_action'
	| 'approval'
	| 'evaluation'
	| 'custom';
export type SpanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StartRunInput = {
	schemaVersion?: TraceSchemaVersion;
	goal: string;
	name?: string;
	agentName?: string;
	agentVersion?: string;
	environment?: string;
	metadata?: unknown;
};

export type LogEventInput = {
	spanId?: string;
	type: EventType;
	title?: string;
	message?: string;
	data?: unknown;
	status?: EventStatus;
	occurredAt?: string;
};

export type StartSpanInput = {
	parentSpanId?: string;
	kind: SpanKind;
	name: string;
	status?: SpanStatus;
	input?: unknown;
	attributes?: unknown;
	startedAt?: string;
};

export type EndSpanInput = {
	status: Exclude<SpanStatus, 'pending' | 'running'>;
	output?: unknown;
	error?: unknown;
	attributes?: unknown;
	endedAt?: string;
};

export type AttachArtifactInput = {
	eventId?: string;
	type: ArtifactType;
	name?: string;
	mimeType?: string;
	url?: string;
	content?: string;
	metadata?: unknown;
};
