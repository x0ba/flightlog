import type { AttachArtifactInput, LogEventInput, RunStatus, StartRunInput } from './types';

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
