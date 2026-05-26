import type {
	AttachArtifactInput,
	EndSpanInput,
	LogEventInput,
	RunStatus,
	StartRunInput,
	StartSpanInput
} from './types';

type ClientConfig = {
	endpoint: string;
	apiKey?: string;
};

export class FlightLogClient {
	private endpoint: string;
	private apiKey?: string;

	constructor(config: ClientConfig) {
		this.endpoint = config.endpoint.replace(/\/$/, '');
		this.apiKey = config.apiKey;
	}

	async startRun(input: StartRunInput) {
		const response = await this.request<{ run: { id: string; status: RunStatus } }>('/api/runs', {
			method: 'POST',
			body: input
		});
		return new FlightLogRun(this, response.run.id);
	}

	async startTrace(input: StartRunInput) {
		const response = await this.request<{
			trace: { id: string; schemaVersion: string; status: RunStatus };
		}>('/api/v1/traces', {
			method: 'POST',
			body: { schemaVersion: 'flightlog.trace.v1', ...input }
		});
		return new FlightLogTrace(this, response.trace.id);
	}

	async createRegressionSuite(input: {
		name: string;
		description?: string;
		repositoryOwner: string;
		repositoryName: string;
		evaluationPolicy?: {
			minScore?: number;
			allowConstraintViolations?: boolean;
			allowErrorFindings?: boolean;
		};
	}) {
		const response = await this.request<{ suite: { id: string; name: string } }>(
			'/api/regression/suites',
			{ method: 'POST', body: input }
		);
		return response.suite;
	}

	async addRegressionCase(
		suiteId: string,
		input: {
			name: string;
			goal: string;
			constraints?: string[];
			expectedBehavior?: string;
			minScore?: number;
			agentConfig?: unknown;
		}
	) {
		const response = await this.request<{ case: { id: string; name: string } }>(
			`/api/regression/suites/${suiteId}`,
			{ method: 'POST', body: input }
		);
		return response.case;
	}

	async startRegressionRun(
		suiteId: string,
		input: {
			githubSha?: string;
			githubRef?: string;
			pullRequestNumber?: number;
			metadata?: unknown;
		} = {}
	) {
		const response = await this.request<{ run: { id: string; status: string; pageUrl: string } }>(
			`/api/regression/suites/${suiteId}/runs`,
			{
				method: 'POST',
				body: {
					...input,
					executionMode: 'external'
				}
			}
		);
		return response.run;
	}

	async finishRegressionCase(
		regressionRunId: string,
		caseId: string,
		input: { runId: string; constraints?: string[] }
	) {
		return this.request<{
			passed: boolean;
			reason?: string;
			evaluation: {
				id: string;
				score: number;
				status: string;
				summary: string | null;
			};
		}>(`/api/regression/runs/${regressionRunId}/cases/${caseId}/complete`, {
			method: 'POST',
			body: input
		});
	}

	async request<T>(path: string, init: { method: string; body?: unknown }) {
		const response = await fetch(`${this.endpoint}${path}`, {
			method: init.method,
			headers: {
				'content-type': 'application/json',
				...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
			},
			body: init.body ? JSON.stringify(init.body) : undefined
		});
		if (!response.ok)
			throw new Error(`FlightLog request failed: ${response.status} ${await response.text()}`);
		return (await response.json()) as T;
	}
}

export class FlightLogRun {
	constructor(
		private client: FlightLogClient,
		public id: string
	) {}

	logEvent(input: LogEventInput) {
		return this.client.request<{ event: { id: string; sequence: number } }>(
			`/api/runs/${this.id}/events`,
			{ method: 'POST', body: input }
		);
	}

	logPlan(message: string) {
		return this.logEvent({ type: 'plan', message });
	}

	logPlannedAction(message: string, data?: unknown) {
		return this.logEvent({ type: 'planned_action', message, data });
	}

	logToolCall(data: unknown) {
		return this.logEvent({ type: 'tool_call', data, status: 'pending' });
	}

	logToolResult(data: unknown) {
		return this.logEvent({ type: 'tool_result', data });
	}

	logObservation(message: string, data?: unknown) {
		return this.logEvent({ type: 'observation', message, data });
	}

	logReasoningSummary(message: string) {
		return this.logEvent({ type: 'reasoning_summary', message });
	}

	logHumanApproval(data: unknown) {
		return this.logEvent({ type: 'human_approval', data });
	}

	attachScreenshot(input: Omit<AttachArtifactInput, 'type'>) {
		return this.attachArtifact({ ...input, type: 'screenshot' });
	}

	attachArtifact(input: AttachArtifactInput) {
		return this.client.request<{ artifact: { id: string; type: string } }>(
			`/api/runs/${this.id}/artifacts`,
			{ method: 'POST', body: input }
		);
	}

	finish(input: { status: Exclude<RunStatus, 'running'>; metadata?: unknown }) {
		return this.client.request<{ run: { id: string; status: RunStatus } }>(`/api/runs/${this.id}`, {
			method: 'PATCH',
			body: input
		});
	}

	evaluate(input: { constraints?: string[] } = {}) {
		return this.client.request<{ evaluation: { id: string; status: string } }>(
			`/api/runs/${this.id}/evaluate`,
			{ method: 'POST', body: input }
		);
	}
}

export class FlightLogTrace {
	constructor(
		private client: FlightLogClient,
		public id: string
	) {}

	logEvent(input: LogEventInput) {
		return this.client.request<{ event: { id: string; sequence: number } }>(
			`/api/v1/traces/${this.id}/events`,
			{ method: 'POST', body: input }
		);
	}

	startSpan(input: StartSpanInput) {
		return this.client
			.request<{ span: { id: string; status: string } }>(`/api/v1/traces/${this.id}/spans`, {
				method: 'POST',
				body: input
			})
			.then((response) => new FlightLogSpan(this, response.span.id));
	}

	async logToolCall(input: {
		name: string;
		input?: unknown;
		attributes?: unknown;
		parentSpanId?: string;
	}) {
		return this.startSpan({
			kind: 'tool_call',
			name: input.name,
			input: input.input,
			attributes: input.attributes,
			parentSpanId: input.parentSpanId,
			status: 'running'
		});
	}

	async logModelCall(input: {
		name: string;
		input?: unknown;
		attributes?: unknown;
		parentSpanId?: string;
	}) {
		return this.startSpan({
			kind: 'model_call',
			name: input.name,
			input: input.input,
			attributes: input.attributes,
			parentSpanId: input.parentSpanId,
			status: 'running'
		});
	}

	async logBrowserAction(input: {
		name: string;
		input?: unknown;
		attributes?: unknown;
		parentSpanId?: string;
	}) {
		return this.startSpan({
			kind: 'browser_action',
			name: input.name,
			input: input.input,
			attributes: input.attributes,
			parentSpanId: input.parentSpanId,
			status: 'running'
		});
	}

	attachArtifact(input: AttachArtifactInput) {
		return this.client.request<{ artifact: { id: string; type: string } }>(
			`/api/runs/${this.id}/artifacts`,
			{ method: 'POST', body: input }
		);
	}

	finish(input: { status: Exclude<RunStatus, 'running'>; metadata?: unknown }) {
		return this.client.request<{ trace: { id: string; status: RunStatus } }>(
			`/api/v1/traces/${this.id}`,
			{ method: 'PATCH', body: input }
		);
	}

	evaluate(input: { constraints?: string[] } = {}) {
		return this.client.request<{ evaluation: { id: string; status: string; score?: number } }>(
			`/api/runs/${this.id}/evaluate`,
			{ method: 'POST', body: input }
		);
	}

	endSpan(spanId: string, input: EndSpanInput) {
		return this.client.request<{ span: { id: string; status: string } }>(
			`/api/v1/traces/${this.id}/spans/${spanId}`,
			{ method: 'PATCH', body: input }
		);
	}
}

export class FlightLogSpan {
	constructor(
		private trace: FlightLogTrace,
		public id: string
	) {}

	logEvent(input: Omit<LogEventInput, 'spanId'>) {
		return this.trace.logEvent({ ...input, spanId: this.id });
	}

	end(input: EndSpanInput) {
		return this.trace.endSpan(this.id, input);
	}

	complete(output?: unknown, attributes?: unknown) {
		return this.end({ status: 'completed', output, attributes });
	}

	fail(error: unknown, attributes?: unknown) {
		return this.end({ status: 'failed', error, attributes });
	}
}
