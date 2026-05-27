import { z } from 'zod';

export const runStatusSchema = z.enum(['running', 'success', 'failed', 'cancelled']);
export const providerSchema = z.enum(['openai', 'anthropic', 'browserbase']);
export const agentProviderSchema = z.enum(['openai', 'anthropic']);
export const credentialAuthTypeSchema = z.enum(['api_key', 'chatgpt_oauth']);

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmedString = (max: number) => z.string().trim().min(1).max(max).optional();

export const credentialIdSchema = trimmedString(64);
export const providerLabelSchema = trimmedString(120);
export const providerApiKeySchema = trimmedString(512);
export const browserbaseProjectIdSchema = trimmedString(128);
export const agentFrameworkSchema = z.enum(['native', 'ai-sdk', 'langchain', 'custom']);
export const runModeSchema = z.enum(['browser', 'tool_agent']);
export const approvalPolicySchema = z.enum(['risk_based', 'always', 'never']);
export const eventTypeSchema = z.enum([
	'goal',
	'plan',
	'planned_action',
	'tool_call',
	'tool_result',
	'browser_action',
	'observation',
	'reasoning_summary',
	'human_approval',
	'constraint',
	'error',
	'final_result',
	'goal.set',
	'plan.created',
	'model_call.requested',
	'model_call.started',
	'model_call.completed',
	'model_call.failed',
	'tool_call.requested',
	'tool_call.started',
	'tool_call.completed',
	'tool_call.failed',
	'browser_action.requested',
	'browser_action.started',
	'browser_action.completed',
	'browser_action.failed',
	'observation.created',
	'reasoning_summary.created',
	'approval.requested',
	'approval.resolved',
	'constraint.checked',
	'artifact.attached',
	'evaluation.created',
	'evaluation.completed',
	'trace.completed',
	'trace.failed'
]);
export const eventStatusSchema = z.enum(['pending', 'success', 'failed', 'skipped']);
export const traceSchemaVersionSchema = z.literal('flightlog.trace.v1');
export const spanKindSchema = z.enum([
	'agent',
	'model_call',
	'tool_call',
	'browser_action',
	'approval',
	'evaluation',
	'custom'
]);
export const spanStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export const artifactTypeSchema = z.enum([
	'screenshot',
	'dom_snapshot',
	'html',
	'text',
	'json',
	'log'
]);

const jsonValue = z.unknown();

export const createRunSchema = z.object({
	schemaVersion: traceSchemaVersionSchema.optional(),
	name: z.string().min(1).optional(),
	goal: z.string().min(1),
	agentName: z.string().min(1).optional(),
	agentVersion: z.string().min(1).optional(),
	environment: z.string().min(1).optional(),
	metadata: jsonValue.optional()
});

export const updateRunSchema = z.object({
	status: runStatusSchema,
	metadata: jsonValue.optional()
});

export const appendEventSchema = z.object({
	spanId: z.string().min(1).optional(),
	type: eventTypeSchema,
	title: z.string().min(1).optional(),
	message: z.string().optional(),
	data: jsonValue.optional(),
	status: eventStatusSchema.optional(),
	occurredAt: z.string().datetime().optional()
});

export const batchEventsSchema = z.object({
	events: z.array(appendEventSchema).min(1)
});

export const createArtifactSchema = z.object({
	eventId: z.string().min(1).optional().nullable(),
	type: artifactTypeSchema,
	name: z.string().min(1).optional(),
	mimeType: z.string().min(1).optional(),
	url: z.string().min(1).optional().nullable(),
	content: z.string().optional().nullable(),
	metadata: jsonValue.optional()
});

export const createTraceSchema = createRunSchema.extend({
	schemaVersion: traceSchemaVersionSchema.default('flightlog.trace.v1')
});

export const updateTraceSchema = updateRunSchema.extend({
	schemaVersion: traceSchemaVersionSchema.optional()
});

export const createSpanSchema = z.object({
	parentSpanId: z.string().min(1).optional().nullable(),
	kind: spanKindSchema,
	name: z.string().min(1),
	status: spanStatusSchema.optional().default('running'),
	input: jsonValue.optional(),
	attributes: jsonValue.optional(),
	startedAt: z.string().datetime().optional()
});

export const updateSpanSchema = z.object({
	status: spanStatusSchema,
	output: jsonValue.optional(),
	error: jsonValue.optional(),
	attributes: jsonValue.optional(),
	endedAt: z.string().datetime().optional()
});

export const evaluateRunSchema = z.object({
	constraints: z.array(z.string().min(1)).optional().default([])
});

export const createAgentRunSchema = z.object({
	prompt: trimmedString(10_000),
	name: optionalTrimmedString(200),
	constraints: z.array(trimmedString(2_000)).optional().default([]),
	runMode: runModeSchema.default('tool_agent'),
	provider: agentProviderSchema.default('openai'),
	framework: agentFrameworkSchema.optional().default('native'),
	model: optionalTrimmedString(120),
	credentialId: credentialIdSchema.optional(),
	browserbaseCredentialId: credentialIdSchema.optional(),
	tools: z.array(trimmedString(120)).optional().default([]),
	approvalPolicy: approvalPolicySchema.optional().default('risk_based'),
	maxSteps: z.number().int().min(1).max(100).optional(),
	temperature: z.number().min(0).max(2).optional(),
	systemPrompt: z.string().trim().max(20_000).optional()
});

export const approvalDecisionSchema = z.object({
	approvalId: z.string().min(1),
	decision: z.enum(['approved', 'rejected']),
	note: z.string().optional()
});

export const chatgptOAuthConnectSchema = z.object({
	label: providerLabelSchema
});

export const createProviderCredentialSchema = z
	.object({
		provider: providerSchema,
		label: providerLabelSchema,
		apiKey: providerApiKeySchema,
		projectId: browserbaseProjectIdSchema.optional()
	})
	.superRefine((value, ctx) => {
		if (value.provider === 'browserbase' && value.projectId === undefined) {
			ctx.addIssue({
				code: 'custom',
				message: 'Browserbase credentials require a project ID.',
				path: ['projectId']
			});
		}
		if (value.provider !== 'browserbase' && value.projectId !== undefined) {
			ctx.addIssue({
				code: 'custom',
				message: 'Project ID is only valid for Browserbase credentials.',
				path: ['projectId']
			});
		}
	});

export const updateProviderCredentialSchema = z
	.object({
		label: providerLabelSchema.optional(),
		apiKey: providerApiKeySchema.optional(),
		projectId: browserbaseProjectIdSchema.optional(),
		isEnabled: z.boolean().optional()
	})
	.refine(
		(value) =>
			value.label !== undefined ||
			value.apiKey !== undefined ||
			value.projectId !== undefined ||
			value.isEnabled !== undefined,
		{ message: 'At least one field is required.' }
	);
// Note: projectId is Browserbase-only; the service layer returns undefined
// (mapped to 404 by the PATCH handler) if projectId is sent for a non-browserbase
// credential. A superRefine here cannot check the persisted provider type, so
// the service layer should return a typed error instead of undefined to allow
// the handler to respond with 400 rather than 404.

export const evaluationPolicySchema = z.object({
	minScore: z.number().int().min(0).max(100).default(70),
	allowConstraintViolations: z.boolean().default(false),
	allowErrorFindings: z.boolean().default(false)
});

export const agentConfigSchema = z.object({
	runMode: runModeSchema.default('tool_agent'),
	provider: agentProviderSchema.default('openai'),
	framework: agentFrameworkSchema.default('native'),
	model: optionalTrimmedString(120),
	credentialId: credentialIdSchema.optional(),
	browserbaseCredentialId: credentialIdSchema.optional(),
	tools: z.array(trimmedString(120)).optional().default([]),
	approvalPolicy: approvalPolicySchema.default('risk_based'),
	maxSteps: z.number().int().min(1).max(100).optional(),
	temperature: z.number().min(0).max(2).optional(),
	systemPrompt: z.string().trim().max(20_000).optional()
});

export const createRegressionSuiteSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	repositoryOwner: z.string().min(1),
	repositoryName: z.string().min(1),
	githubInstallationId: z.number().int().positive().optional(),
	enabled: z.boolean().optional().default(true),
	evaluationPolicy: evaluationPolicySchema.optional()
});

export const createRegressionCaseSchema = z.object({
	name: z.string().min(1),
	goal: z.string().min(1),
	constraints: z.array(z.string().min(1)).optional().default([]),
	expectedBehavior: z.string().optional(),
	agentConfig: agentConfigSchema.optional(),
	minScore: z.number().int().min(0).max(100).optional().default(70),
	sortOrder: z.number().int().min(0).optional().default(0),
	enabled: z.boolean().optional().default(true)
});

export const startRegressionRunSchema = z.object({
	githubSha: z.string().min(1).optional(),
	githubRef: z.string().min(1).optional(),
	pullRequestNumber: z.number().int().positive().optional(),
	metadata: jsonValue.optional()
});

export const completeRegressionCaseRunSchema = z.object({
	runId: z.string().min(1),
	constraints: z.array(z.string().min(1)).optional()
});

export const linkGithubInstallationSchema = z.object({
	installationId: z.number().int().positive(),
	accountLogin: z.string().min(1),
	accountType: z.string().min(1)
});
