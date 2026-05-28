import { sentrySvelteKit } from '@sentry/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			org: 'daniel-xu-wv',
			project: 'flightlog'
		}),
		tailwindcss(),
		sveltekit()
	],
	ssr: {
		noExternal: ['bits-ui']
	},
	test: {
		include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
		setupFiles: ['test/setup.ts'],
		environment: 'node',
		pool: 'forks',
		fileParallelism: false
	}
});
