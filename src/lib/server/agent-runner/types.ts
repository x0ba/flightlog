import type {
	artifacts,
	evaluationFindings,
	evaluations,
	events,
	runs,
	spans
} from '$lib/server/db/schema';

export type RunRow = typeof runs.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type SpanRow = typeof spans.$inferSelect;
export type ArtifactRow = typeof artifacts.$inferSelect & { eventSequence?: number | null };

export type AgentRunStatus =
	| 'queued'
	| 'running'
	| 'waiting_for_approval'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type SafetyCheck = {
	id: string;
	code: string;
	message: string;
};

export type PendingApproval = {
	id: string;
	callId: string;
	safetyChecks: SafetyCheck[];
	action: unknown;
	screenshotArtifactId?: string;
	createdAt: string;
};

export type AgentRequestMetadata = {
	prompt: string;
	constraints?: string[];
	status: AgentRunStatus;
	startedAt?: string;
	completedAt?: string;
	provider?: 'openai' | 'anthropic';
	framework?: 'native' | 'ai-sdk' | 'langchain' | 'custom';
	model?: string;
	credentialId?: string;
	runMode?: 'browser' | 'tool_agent';
	tools?: string[];
	approvalPolicy?: 'risk_based' | 'always' | 'never';
	maxSteps?: number;
	temperature?: number;
	systemPrompt?: string;
	openaiResponseId?: string;
	pendingApproval?: PendingApproval;
	stepCount?: number;
	error?: string;
};

export type RunMetadata = {
	agentRequest?: AgentRequestMetadata;
	[key: string]: unknown;
};

export type SnapshotPayload = {
	run: RunRow;
	spans: SpanRow[];
	events: EventRow[];
	artifacts: ArtifactRow[];
	evaluation: typeof evaluations.$inferSelect | undefined;
	findings: Array<typeof evaluationFindings.$inferSelect>;
};

export type StreamEvent =
	| { type: 'snapshot'; data: SnapshotPayload }
	| { type: 'run'; data: RunRow }
	| { type: 'span'; data: SpanRow }
	| { type: 'event'; data: EventRow }
	| { type: 'artifact'; data: ArtifactRow }
	| { type: 'approval_required'; data: PendingApproval }
	| { type: 'done'; data: { run: RunRow } }
	| { type: 'error'; data: { message: string } };

export type ApprovalDecision = {
	approvalId: string;
	decision: 'approved' | 'rejected';
	note?: string;
};

export type ComputerAction =
	| { type: 'click'; x: number; y: number; button?: string }
	| { type: 'double_click'; x: number; y: number; button?: string }
	| { type: 'scroll'; x?: number; y?: number; scroll_x?: number; scroll_y?: number }
	| { type: 'keypress'; keys: string[] }
	| { type: 'type'; text: string }
	| { type: 'wait' }
	| { type: 'screenshot' }
	| { type: 'unknown'; raw?: unknown };

export type ComputerCall = {
	type: 'computer_call';
	call_id: string;
	action: ComputerAction;
	pending_safety_checks?: SafetyCheck[];
	status?: string;
};

export type ReasoningItem = {
	type: 'reasoning';
	summary?: Array<{ type?: string; text?: string }>;
};

export type OutputTextItem = {
	type: 'message';
	content?: Array<{ type?: string; text?: string }>;
};

export type OpenAIComputerResponse = {
	id: string;
	output?: Array<ComputerCall | ReasoningItem | OutputTextItem | { type?: string }>;
	output_text?: string;
};
