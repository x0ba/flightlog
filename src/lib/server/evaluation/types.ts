import { z } from 'zod';

export const findingSchema = z.object({
	severity: z.enum(['info', 'warning', 'error']),
	category: z.enum([
		'goal_completion',
		'constraint_violation',
		'repetition',
		'human_approval',
		'tool_failure',
		'other'
	]),
	message: z.string(),
	eventPublicId: z.string().optional()
});

export const llmEvaluationSchema = z.object({
	goalCompleted: z.boolean(),
	violatedConstraints: z.boolean(),
	score: z.number().int().min(0).max(100),
	summary: z.string(),
	explanation: z.string(),
	findings: z.array(findingSchema)
});

export type EvaluationFindingInput = z.infer<typeof findingSchema>;
export type LlmEvaluation = z.infer<typeof llmEvaluationSchema>;
