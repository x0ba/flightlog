import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spans } from '$lib/server/db/schema';
import { appendEvent } from '$lib/server/events';
import { evaluateRun } from '$lib/server/evaluation/service';
import { getProviderApiKey } from '$lib/server/provider-credentials';
import { publicId } from '$lib/server/public-id';
import { updateRun } from '$lib/server/runs';
import { requiresApproval, selectedTools, toolRegistry } from '$lib/server/tools/registry';
import { providerAdapter, type AgentModelMessage, type AgentToolCall } from './providers';
import { publishRunEvent } from './stream';
import type { AgentRequestMetadata } from './types';

export type ToolAgentRunInput = {
	run: {
		id: number;
		publicId: string;
		ownerUserId: string;
		goal: string;
		metadata: unknown;
	};
	request: AgentRequestMetadata;
	credentialId: string;
};

export async function runToolAgent(input: ToolAgentRunInput) {
	const provider = input.request.provider ?? 'openai';
	const model = input.request.model;
	if (!model) throw new Error('Model is required');
	if (!input.request.credentialId) throw new Error('Provider credential is required');
	const credential = await getProviderApiKey(input.run.ownerUserId, input.credentialId, provider);
	if (!credential) throw new Error('Provider credential was not found or is disabled');

	const adapter = providerAdapter(provider);
	const tools = selectedTools(input.request.tools ?? []);
	const approvalPolicy = input.request.approvalPolicy ?? 'risk_based';
	const maxSteps = input.request.maxSteps ?? 12;
	const messages: AgentModelMessage[] = [
		{
			role: 'system',
			content:
				input.request.systemPrompt ||
				'You are an autonomous tool-using agent. Use available tools when useful, then provide a concise final answer.'
		},
		{ role: 'user', content: input.request.prompt }
	];

	await appendAndPublish(input.run.id, input.run.publicId, {
		type: 'goal.set',
		title: 'Goal',
		message: input.request.prompt,
		status: 'success',
		data: { provider, model, framework: input.request.framework, runMode: 'tool_agent' }
	});

	const rootSpan = await createSpan(input.run.id, input.run.publicId, {
		kind: 'agent',
		name: 'Tool agent',
		status: 'running',
		input: { prompt: input.request.prompt, tools: tools.map((tool) => tool.name) },
		attributes: { provider, model, framework: input.request.framework }
	});

	for (let step = 1; step <= maxSteps; step += 1) {
		const modelSpan = await createSpan(input.run.id, input.run.publicId, {
			parentSpanId: rootSpan.id,
			kind: 'model_call',
			name: `${provider}:${model}`,
			status: 'running',
			input: { messages, tools: tools.map((tool) => tool.name) },
			attributes: { provider, model, framework: input.request.framework, step }
		});
		await appendAndPublish(input.run.id, input.run.publicId, {
			spanId: modelSpan.publicId,
			type: 'model_call.started',
			title: modelSpan.name,
			status: 'pending',
			data: { provider, model, step }
		});

		const result = await adapter.createResponse({
			model,
			apiKey: credential.apiKey,
			messages,
			tools,
			temperature: input.request.temperature
		});
		await completeSpan(input.run.publicId, modelSpan.id, {
			output: { text: result.text, toolCalls: result.toolCalls, id: result.id },
			attributes: { provider, model, framework: input.request.framework, step }
		});
		await appendAndPublish(input.run.id, input.run.publicId, {
			spanId: modelSpan.publicId,
			type: 'model_call.completed',
			title: modelSpan.name,
			message: result.text,
			status: 'success',
			data: { id: result.id, toolCalls: result.toolCalls, raw: result.raw }
		});
		if (result.reasoningSummary) {
			await appendAndPublish(input.run.id, input.run.publicId, {
				type: 'reasoning_summary.created',
				title: 'Reasoning summary',
				message: result.reasoningSummary,
				status: 'success'
			});
		}

		if (!result.toolCalls.length) {
			await finish(input, rootSpan.id, result.text ?? 'Agent run completed.');
			return;
		}

		if (result.text) messages.push({ role: 'assistant', content: result.text });
		for (const call of result.toolCalls) {
			const output = await executeToolCall(input, rootSpan.id, call, approvalPolicy);
			messages.push({
				role: 'tool',
				name: call.name,
				toolCallId: call.id,
				content: JSON.stringify(output)
			});
		}
	}

	throw new Error(`Agent stopped after reaching the ${maxSteps} step limit.`);
}

async function executeToolCall(
	input: ToolAgentRunInput,
	parentSpanId: number,
	call: AgentToolCall,
	approvalPolicy: 'risk_based' | 'always' | 'never'
) {
	const tool = toolRegistry[call.name];
	if (!tool) return { error: `Unknown tool: ${call.name}` };
	if (requiresApproval(tool.risk, approvalPolicy)) {
		throw new Error(
			`Tool ${call.name} requires approval, but tool-agent approvals are not implemented yet`
		);
	}

	const span = await createSpan(input.run.id, input.run.publicId, {
		parentSpanId,
		kind: 'tool_call',
		name: call.name,
		status: 'running',
		input: call.input,
		attributes: { risk: tool.risk, toolCallId: call.id }
	});
	await appendAndPublish(input.run.id, input.run.publicId, {
		spanId: span.publicId,
		type: 'tool_call.started',
		title: call.name,
		status: 'pending',
		data: { input: call.input, risk: tool.risk, toolCallId: call.id }
	});

	try {
		const output = await tool.execute(call.input);
		await completeSpan(input.run.publicId, span.id, {
			output,
			attributes: { risk: tool.risk, toolCallId: call.id }
		});
		await appendAndPublish(input.run.id, input.run.publicId, {
			spanId: span.publicId,
			type: 'tool_call.completed',
			title: call.name,
			status: 'success',
			data: { output, risk: tool.risk, toolCallId: call.id }
		});
		return output;
	} catch (cause) {
		const error =
			cause instanceof Error
				? { message: cause.message, name: cause.name }
				: { message: String(cause) };
		await failSpan(input.run.publicId, span.id, {
			error,
			attributes: { risk: tool.risk, toolCallId: call.id }
		});
		await appendAndPublish(input.run.id, input.run.publicId, {
			spanId: span.publicId,
			type: 'tool_call.failed',
			title: call.name,
			status: 'failed',
			data: { error, risk: tool.risk, toolCallId: call.id }
		});
		return { error };
	}
}

async function finish(input: ToolAgentRunInput, rootSpanId: number, message: string) {
	await completeSpan(input.run.publicId, rootSpanId, {
		output: { message },
		attributes: { status: 'completed' }
	});
	await appendAndPublish(input.run.id, input.run.publicId, {
		type: 'final_result',
		title: 'Final result',
		message,
		status: 'success'
	});
	const updated = await updateRun(input.run.publicId, {
		status: 'success',
		metadata: {
			...(input.run.metadata && typeof input.run.metadata === 'object' ? input.run.metadata : {}),
			agentRequest: {
				...input.request,
				status: 'completed',
				completedAt: new Date().toISOString()
			}
		}
	});
	if (updated) {
		publishRunEvent(input.run.publicId, { type: 'run', data: updated });
		publishRunEvent(input.run.publicId, { type: 'done', data: { run: updated } });
	}
	if (input.request.constraints?.length)
		await evaluateRun(input.run.publicId, undefined, input.request.constraints);
}

async function createSpan(
	runId: number,
	publicRunId: string,
	input: Omit<typeof spans.$inferInsert, 'publicId' | 'runId'>
) {
	const [span] = await db
		.insert(spans)
		.values({
			...input,
			publicId: publicId('spn'),
			runId,
			startedAt: input.startedAt ?? new Date()
		})
		.returning();
	publishRunEvent(publicRunId, { type: 'span', data: span });
	return span;
}

async function completeSpan(
	publicRunId: string,
	spanId: number,
	input: { output: unknown; attributes: unknown }
) {
	const [span] = await db
		.update(spans)
		.set({
			status: 'completed',
			output: input.output,
			attributes: input.attributes,
			endedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(spans.id, spanId))
		.returning();
	if (span) publishRunEvent(publicRunId, { type: 'span', data: span });
}

async function failSpan(
	publicRunId: string,
	spanId: number,
	input: { error: unknown; attributes: unknown }
) {
	const [span] = await db
		.update(spans)
		.set({
			status: 'failed',
			error: input.error,
			attributes: input.attributes,
			endedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(spans.id, spanId))
		.returning();
	if (span) publishRunEvent(publicRunId, { type: 'span', data: span });
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
