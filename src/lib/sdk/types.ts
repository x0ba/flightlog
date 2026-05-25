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
	| 'final_result';
export type EventStatus = 'pending' | 'success' | 'failed' | 'skipped';
export type ArtifactType = 'screenshot' | 'dom_snapshot' | 'html' | 'text' | 'json' | 'log';

export type StartRunInput = {
	goal: string;
	name?: string;
	agentName?: string;
	agentVersion?: string;
	environment?: string;
	metadata?: unknown;
};

export type LogEventInput = {
	type: EventType;
	title?: string;
	message?: string;
	data?: unknown;
	status?: EventStatus;
	occurredAt?: string;
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
