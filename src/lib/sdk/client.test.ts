import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlightLogClient } from './client';

describe('FlightLogClient', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('starts a run against the runs API', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ run: { id: 'run_123', status: 'running' } }), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchMock);

		const client = new FlightLogClient({
			endpoint: 'https://flightlog.example/',
			apiKey: 'token_abc'
		});
		const run = await client.startRun({ goal: 'Book a flight' });

		expect(run.id).toBe('run_123');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://flightlog.example/api/runs',
			expect.objectContaining({
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: 'Bearer token_abc'
				},
				body: JSON.stringify({ goal: 'Book a flight' })
			})
		);
	});

	it('starts a trace against the v1 traces API', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					trace: { id: 'run_trace', schemaVersion: 'flightlog.trace.v1', status: 'running' }
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		const client = new FlightLogClient({ endpoint: 'https://flightlog.example' });
		const trace = await client.startTrace({ goal: 'Trace a workflow', agentName: 'demo-agent' });

		expect(trace.id).toBe('run_trace');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://flightlog.example/api/v1/traces',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					schemaVersion: 'flightlog.trace.v1',
					goal: 'Trace a workflow',
					agentName: 'demo-agent'
				})
			})
		);
	});

	it('throws when the API returns an error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad request', { status: 400 })));

		const client = new FlightLogClient({ endpoint: 'https://flightlog.example' });
		await expect(client.startRun({ goal: 'Fail' })).rejects.toThrow(
			'FlightLog request failed: 400 bad request'
		);
	});
});
