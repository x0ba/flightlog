import { requireUserId } from '$lib/server/auth';
import { requireRunForUser } from '$lib/server/http';
import { getRunSnapshot, maybeStartAgentRun } from '$lib/server/agent-runner/service';
import { encodeSse, subscribeToRun } from '$lib/server/agent-runner/stream';

export async function GET(event) {
	const userId = requireUserId(event);
	const { params, request } = event;
	const run = await requireRunForUser(params.id, userId, 'Run not found');
	const snapshot = await getRunSnapshot(run);

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false;
			const send = (chunk: string) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					cleanup();
				}
			};
			const cleanup = () => {
				if (closed) return;
				closed = true;
				clearInterval(heartbeat);
				unsubscribe();
			};
			const close = () => {
				cleanup();
				try {
					controller.close();
				} catch {
					// The runtime may close the controller before the abort signal is delivered.
				}
			};
			const unsubscribe = subscribeToRun(params.id, (event) => send(encodeSse(event)));
			const heartbeat = setInterval(() => send(': heartbeat\n\n'), 15000);
			send(encodeSse({ type: 'snapshot', data: snapshot }));

			request.signal.addEventListener('abort', close, { once: true });

			void maybeStartAgentRun(params.id);
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive'
		}
	});
}
