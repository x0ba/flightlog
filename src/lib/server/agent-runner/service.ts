import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { artifacts, evaluationFindings, evaluations, events } from '$lib/server/db/schema';
import { createArtifact, listArtifacts } from '$lib/server/artifacts';
import { appendEvent, listEvents } from '$lib/server/events';
import { evaluateRun } from '$lib/server/evaluation/service';
import { findRun, patchRunMetadata, updateRun } from '$lib/server/runs';
import { createBrowserSession, hasBrowserbaseConfig } from './browser';
import { needsApproval, resolveApproval, waitForApproval } from './approval';
import { continueComputerResponse, createInitialComputerResponse, hasOpenAiKey } from './openai';
import { publishRunEvent } from './stream';
import type {
	AgentRequestMetadata,
	ApprovalDecision,
	ArtifactRow,
	ComputerCall,
	OpenAIComputerResponse,
	PendingApproval,
	ReasoningItem,
	RunMetadata,
	SafetyCheck,
	SnapshotPayload
} from './types';

const activeRuns = new Set<string>();

export async function createAgentRun(input: {
	prompt: string;
	name?: string;
	constraints?: string[];
}) {
	const { createRun } = await import('$lib/server/runs');
	const run = await createRun({
		goal: input.prompt,
		name: input.name || titleFromPrompt(input.prompt),
		agentName: 'OpenAI computer-use',
		agentVersion: env.OPENAI_AGENT_MODEL || 'computer-use-preview',
		environment: 'Browserbase Chromium',
		metadata: {
			agentRequest: {
				prompt: input.prompt,
				constraints: input.constraints ?? [],
				status: 'queued'
			}
		} satisfies RunMetadata
	});
	const goalEvent = await appendEvent(run.id, {
		type: 'goal',
		title: 'Goal',
		message: input.prompt,
		status: 'success'
	});
	publishRunEvent(run.publicId, { type: 'event', data: goalEvent });
	return run;
}

export async function getRunSnapshot(publicRunId: string): Promise<SnapshotPayload | undefined> {
	const run = await findRun(publicRunId);
	if (!run) return undefined;
	const events = await listEvents(run.id);
	const artifactRows = await listArtifacts(run.id);
	const eventSequenceById = new Map(events.map((event) => [event.id, event.sequence]));
	const artifactsWithSequence = artifactRows.map((artifact) => ({
		...artifact,
		eventSequence: artifact.eventId ? (eventSequenceById.get(artifact.eventId) ?? null) : null
	}));
	const [evaluation] = await db
		.select()
		.from(evaluations)
		.where(eq(evaluations.runId, run.id))
		.orderBy(desc(evaluations.createdAt))
		.limit(1);
	const findings = evaluation
		? await db
				.select()
				.from(evaluationFindings)
				.where(eq(evaluationFindings.evaluationId, evaluation.id))
		: [];
	return { run, events, artifacts: artifactsWithSequence, evaluation, findings };
}

export async function maybeStartAgentRun(publicRunId: string) {
	const run = await findRun(publicRunId);
	const agentRequest = readAgentRequest(run?.metadata);
	if (!run || agentRequest?.status !== 'queued' || activeRuns.has(publicRunId)) return false;
	activeRuns.add(publicRunId);
	void runAgent(publicRunId).finally(() => activeRuns.delete(publicRunId));
	return true;
}

export async function decideApproval(publicRunId: string, decision: ApprovalDecision) {
	const run = await findRun(publicRunId);
	if (!run) return undefined;
	const accepted = resolveApproval(publicRunId, decision);
	const row = await appendAndPublish(run.id, publicRunId, {
		type: 'human_approval',
		title: decision.decision === 'approved' ? 'Action approved' : 'Action rejected',
		message: decision.note,
		status: decision.decision === 'approved' ? 'success' : 'failed',
		data: decision
	});
	if (!accepted && decision.decision === 'rejected') {
		await cancelRun(publicRunId, 'Approval rejected after the runner stopped waiting.');
	}
	return row;
}

async function runAgent(publicRunId: string) {
	const initialRun = await findRun(publicRunId);
	const initialAgentRequest = readAgentRequest(initialRun?.metadata);
	if (!initialRun || !initialAgentRequest) return;

	if (!hasOpenAiKey()) {
		await failRun(publicRunId, 'OPENAI_API_KEY is not set');
		return;
	}
	if (!hasBrowserbaseConfig()) {
		await failRun(publicRunId, 'BROWSERBASE_API_KEY is not set');
		return;
	}

	let session: Awaited<ReturnType<typeof createBrowserSession>> | undefined;
	let response: OpenAIComputerResponse | undefined;
	let stepCount = 0;
	let blankNoProgressCount = 0;
	const maxSteps = agentMaxSteps();

	try {
		await setAgentMetadata(publicRunId, {
			...initialAgentRequest,
			status: 'running',
			startedAt: new Date().toISOString()
		});
		const runningRun = await findRun(publicRunId);
		if (runningRun) publishRunEvent(publicRunId, { type: 'run', data: runningRun });

		session = await createBrowserSession(startUrlForPrompt(initialAgentRequest.prompt));
		await patchRunMetadata(publicRunId, {
			browserbase: {
				sessionId: session.browserbaseSessionId,
				debuggerUrl: session.debuggerUrl
			}
		});
		const initialScreenshot = await session.screenshotDataUrl();
		await createAndPublishArtifact(initialRun.id, publicRunId, {
			type: 'screenshot',
			name: 'Initial browser state',
			mimeType: 'image/png',
			content: initialScreenshot,
			metadata: {
				currentUrl: session.currentUrl(),
				browserbaseSessionId: session.browserbaseSessionId,
				browserbaseDebuggerUrl: session.debuggerUrl
			}
		});

		response = await createInitialComputerResponse(initialAgentRequest.prompt, initialScreenshot);
		await setResponseMetadata(publicRunId, response.id, stepCount);

		while (stepCount < maxSteps) {
			await logResponseSummaries(initialRun.id, publicRunId, response);
			const call = firstComputerCall(response);
			if (!call) {
				await completeRun(publicRunId, initialRun.id, response);
				return;
			}

			stepCount += 1;
			const actionEvent = await appendAndPublish(initialRun.id, publicRunId, {
				type: 'browser_action',
				title: `Browser ${call.action.type}`,
				message: summarizeAction(call.action),
				status: 'pending',
				data: {
					callId: call.call_id,
					action: call.action,
					pendingSafetyChecks: call.pending_safety_checks ?? []
				}
			});

			const screenshotBeforeApproval = await session.screenshotDataUrl();
			const approvalScreenshot = await createAndPublishArtifact(initialRun.id, publicRunId, {
				eventId: actionEvent.publicId,
				type: 'screenshot',
				name: `Before ${call.action.type}`,
				mimeType: 'image/png',
				content: screenshotBeforeApproval,
				metadata: { currentUrl: session.currentUrl(), step: stepCount }
			});

			const safetyChecks = call.pending_safety_checks ?? [];
			let acknowledgedSafetyChecks: SafetyCheck[] = [];
			if (needsApproval(call.action, safetyChecks)) {
				const currentAgentRequest = readAgentRequest((await findRun(publicRunId))?.metadata);
				const approval: PendingApproval = {
					id: `approval_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
					callId: call.call_id,
					safetyChecks,
					action: call.action,
					screenshotArtifactId: approvalScreenshot.publicId,
					createdAt: new Date().toISOString()
				};
				await setAgentMetadata(publicRunId, {
					...(currentAgentRequest ?? initialAgentRequest),
					status: 'waiting_for_approval',
					openaiResponseId: response.id,
					pendingApproval: approval,
					stepCount
				});
				publishRunEvent(publicRunId, { type: 'approval_required', data: approval });
				const decision = await waitForApproval(publicRunId, approval);
				if (decision.decision === 'rejected') {
					await cancelRun(publicRunId, decision.note ?? 'Action rejected.');
					return;
				}
				acknowledgedSafetyChecks = safetyChecks;
				const approvedAgentRequest = readAgentRequest((await findRun(publicRunId))?.metadata);
				await setAgentMetadata(publicRunId, {
					...(approvedAgentRequest ?? initialAgentRequest),
					status: 'running',
					openaiResponseId: response.id,
					pendingApproval: undefined,
					stepCount
				});
			}

			await session.executeAction(call.action);
			const screenshot = await session.screenshotDataUrl();
			const artifact = await createAndPublishArtifact(initialRun.id, publicRunId, {
				eventId: actionEvent.publicId,
				type: 'screenshot',
				name: `After ${call.action.type}`,
				mimeType: 'image/png',
				content: screenshot,
				metadata: { currentUrl: session.currentUrl(), step: stepCount }
			});

			await appendAndPublish(initialRun.id, publicRunId, {
				type: 'observation',
				title: 'Browser state captured',
				message: session.currentUrl(),
				status: 'success',
				data: { screenshotArtifactId: artifact.publicId, currentUrl: session.currentUrl() }
			});

			if (isBlankNoProgressAction(call.action, session.currentUrl())) {
				blankNoProgressCount += 1;
				if (blankNoProgressCount >= maxBlankNoProgressActions()) {
					await failRun(
						publicRunId,
						`Agent is stuck on about:blank after ${blankNoProgressCount} wait/screenshot actions.`
					);
					return;
				}
			} else {
				blankNoProgressCount = 0;
			}

			response = await continueComputerResponse({
				previousResponseId: response.id,
				callId: call.call_id,
				screenshotDataUrl: screenshot,
				currentUrl: session.currentUrl(),
				acknowledgedSafetyChecks
			});
			await setResponseMetadata(publicRunId, response.id, stepCount);
		}

		await failRun(publicRunId, `Agent stopped after reaching the ${maxSteps} step limit.`);
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown agent runner error';
		await failRun(publicRunId, message);
	} finally {
		await session?.close();
	}
}

async function appendAndPublish(
	runId: number,
	publicRunId: string,
	input: Parameters<typeof appendEvent>[1]
) {
	const event = await appendEvent(runId, input);
	publishRunEvent(publicRunId, { type: 'event', data: event });
	return event;
}

async function createAndPublishArtifact(
	runId: number,
	publicRunId: string,
	input: Parameters<typeof createArtifact>[1]
) {
	const artifact = await createArtifact(runId, input);
	const enriched = await enrichArtifact(artifact);
	publishRunEvent(publicRunId, { type: 'artifact', data: enriched });
	return enriched;
}

async function enrichArtifact(artifact: typeof artifacts.$inferSelect): Promise<ArtifactRow> {
	if (!artifact.eventId) return { ...artifact, eventSequence: null };
	const [event] = await db
		.select({ sequence: events.sequence })
		.from(events)
		.where(eq(events.id, artifact.eventId))
		.limit(1);
	return { ...artifact, eventSequence: event?.sequence ?? null };
}

async function logResponseSummaries(
	runId: number,
	publicRunId: string,
	response: OpenAIComputerResponse
) {
	for (const item of response.output ?? []) {
		if (!isReasoningItem(item)) continue;
		const summary = item.summary
			?.map((part) => part.text)
			.filter((text) => typeof text === 'string' && text.length > 0)
			.join('\n');
		if (!summary) continue;
		await appendAndPublish(runId, publicRunId, {
			type: 'reasoning_summary',
			title: 'Reasoning summary',
			message: summary,
			status: 'success'
		});
	}
}

async function completeRun(publicRunId: string, runId: number, response: OpenAIComputerResponse) {
	const finalText = response.output_text ?? outputText(response) ?? 'Agent run completed.';
	await appendAndPublish(runId, publicRunId, {
		type: 'final_result',
		title: 'Final result',
		message: finalText,
		status: 'success',
		data: { responseId: response.id }
	});
	const metadata = readAgentRequest((await findRun(publicRunId))?.metadata);
	await setAgentMetadata(publicRunId, {
		...(metadata ?? { prompt: '' }),
		status: 'completed',
		completedAt: new Date().toISOString(),
		openaiResponseId: response.id
	});
	const updated = await updateRun(publicRunId, {
		status: 'success',
		metadata: await mergedMetadata(publicRunId)
	});
	if (updated) {
		publishRunEvent(publicRunId, { type: 'run', data: updated });
		publishRunEvent(publicRunId, { type: 'done', data: { run: updated } });
	}
	const constraints = metadata?.constraints ?? [];
	if (constraints.length) await evaluateRun(publicRunId, constraints);
}

async function failRun(publicRunId: string, message: string) {
	const run = await findRun(publicRunId);
	if (!run) return;
	await appendAndPublish(run.id, publicRunId, {
		type: 'error',
		title: 'Agent run failed',
		message,
		status: 'failed'
	});
	const metadata = readAgentRequest(run.metadata);
	await setAgentMetadata(publicRunId, {
		...(metadata ?? { prompt: run.goal }),
		status: 'failed',
		completedAt: new Date().toISOString(),
		error: message
	});
	const updated = await updateRun(publicRunId, {
		status: 'failed',
		metadata: await mergedMetadata(publicRunId)
	});
	if (updated) {
		publishRunEvent(publicRunId, { type: 'run', data: updated });
		publishRunEvent(publicRunId, { type: 'done', data: { run: updated } });
	}
	publishRunEvent(publicRunId, { type: 'error', data: { message } });
}

async function cancelRun(publicRunId: string, message: string) {
	const run = await findRun(publicRunId);
	if (!run) return;
	await appendAndPublish(run.id, publicRunId, {
		type: 'constraint',
		title: 'Action blocked',
		message,
		status: 'failed'
	});
	await appendAndPublish(run.id, publicRunId, {
		type: 'final_result',
		title: 'Run cancelled',
		message,
		status: 'skipped'
	});
	const metadata = readAgentRequest(run.metadata);
	await setAgentMetadata(publicRunId, {
		...(metadata ?? { prompt: run.goal }),
		status: 'cancelled',
		completedAt: new Date().toISOString()
	});
	const updated = await updateRun(publicRunId, {
		status: 'cancelled',
		metadata: await mergedMetadata(publicRunId)
	});
	if (updated) {
		publishRunEvent(publicRunId, { type: 'run', data: updated });
		publishRunEvent(publicRunId, { type: 'done', data: { run: updated } });
	}
}

async function setResponseMetadata(publicRunId: string, responseId: string, stepCount: number) {
	const metadata = readAgentRequest((await findRun(publicRunId))?.metadata);
	if (!metadata) return;
	await setAgentMetadata(publicRunId, { ...metadata, openaiResponseId: responseId, stepCount });
}

async function setAgentMetadata(publicRunId: string, agentRequest: AgentRequestMetadata) {
	await patchRunMetadata(publicRunId, { agentRequest });
}

async function mergedMetadata(publicRunId: string) {
	return (await findRun(publicRunId))?.metadata;
}

function readAgentRequest(metadata: unknown) {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
	const value = (metadata as RunMetadata).agentRequest;
	if (!value || typeof value !== 'object') return undefined;
	return value;
}

function firstComputerCall(response: OpenAIComputerResponse): ComputerCall | undefined {
	return response.output?.find((item): item is ComputerCall => item.type === 'computer_call');
}

function isReasoningItem(item: unknown): item is ReasoningItem {
	return Boolean(item && typeof item === 'object' && 'type' in item && item.type === 'reasoning');
}

function outputText(response: OpenAIComputerResponse) {
	const chunks: string[] = [];
	for (const item of response.output ?? []) {
		if (item.type !== 'message' || !('content' in item) || !Array.isArray(item.content)) continue;
		for (const part of item.content) {
			if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
				chunks.push(part.text);
			}
		}
	}
	return chunks.join('\n') || undefined;
}

function summarizeAction(action: ComputerCall['action']) {
	if (action.type === 'click') return `Click at ${action.x}, ${action.y}`;
	if (action.type === 'double_click') return `Double click at ${action.x}, ${action.y}`;
	if (action.type === 'scroll') return `Scroll by ${action.scroll_x ?? 0}, ${action.scroll_y ?? 0}`;
	if (action.type === 'keypress') return `Press ${action.keys.join(', ')}`;
	if (action.type === 'type')
		return `Type ${action.text.length} character${action.text.length === 1 ? '' : 's'}`;
	return action.type;
}

function isBlankNoProgressAction(action: ComputerCall['action'], currentUrl: string) {
	return currentUrl === 'about:blank' && (action.type === 'wait' || action.type === 'screenshot');
}

function titleFromPrompt(prompt: string) {
	const normalized = prompt.trim().replace(/\s+/g, ' ');
	return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function startUrlForPrompt(prompt: string) {
	const explicitUrl = explicitUrlFromPrompt(prompt);
	if (explicitUrl) return explicitUrl;

	const knownSiteUrl = knownSiteUrlFromPrompt(prompt);
	if (knownSiteUrl) return knownSiteUrl;

	return `https://www.google.com/search?q=${encodeURIComponent(prompt)}`;
}

function explicitUrlFromPrompt(prompt: string) {
	const match = prompt.match(/\bhttps?:\/\/[^\s<>"')\]]+/i);
	if (!match) return undefined;

	try {
		return new URL(match[0]).toString();
	} catch {
		return undefined;
	}
}

function knownSiteUrlFromPrompt(prompt: string) {
	const normalized = prompt.toLowerCase();
	if (/\b(hacker\s*news|hackernews|hn)\b/.test(normalized)) {
		return 'https://news.ycombinator.com/';
	}
	return undefined;
}

function agentMaxSteps() {
	const value = Number(env.FLIGHTLOG_AGENT_MAX_STEPS ?? 20);
	return Math.max(1, Number.isFinite(value) ? value : 20);
}

function maxBlankNoProgressActions() {
	const value = Number(env.FLIGHTLOG_AGENT_MAX_BLANK_NO_PROGRESS_ACTIONS ?? 3);
	return Math.max(1, Number.isFinite(value) ? value : 3);
}
