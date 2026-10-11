import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

// Dedicated Vite configuration for the unit/component tests. It intentionally does not use the
// SvelteKit plugin: the components under test only depend on `#lib/*` subpath imports (declared in
// package.json) and never on `$app/*` modules.
export default defineConfig({
	plugins: [svelte({ preprocess: vitePreprocess() }), svelteTesting()],
	test: {
		environment: 'jsdom',
		// Pin the timezone so date-formatting assertions are deterministic across machines/CI.
		env: { TZ: 'UTC' },
		setupFiles: ['./test/setup.ts'],
		include: ['test/**/*.{test,spec}.{ts,js}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/**/*.{ts,svelte}'],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
	},
});
