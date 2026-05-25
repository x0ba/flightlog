import type { StreamEvent } from './types';

type Listener = (event: StreamEvent) => void;

const listenersByRun = new Map<string, Set<Listener>>();

export function subscribeToRun(publicRunId: string, listener: Listener) {
	const listeners = listenersByRun.get(publicRunId) ?? new Set<Listener>();
	listeners.add(listener);
	listenersByRun.set(publicRunId, listeners);

	return () => {
		listeners.delete(listener);
		if (!listeners.size) listenersByRun.delete(publicRunId);
	};
}

export function publishRunEvent(publicRunId: string, event: StreamEvent) {
	const listeners = listenersByRun.get(publicRunId);
	if (!listeners) return;
	for (const listener of listeners) listener(event);
}

export function encodeSse(event: StreamEvent) {
	return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
