import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';

export function providerAdapter(provider: 'openai' | 'anthropic') {
	if (provider === 'openai') return openaiProvider;
	return anthropicProvider;
}

export type * from './types';
