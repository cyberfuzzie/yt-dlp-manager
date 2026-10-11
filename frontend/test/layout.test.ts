import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Layout from '../src/routes/+layout.svelte';

describe('root layout', () => {
	it('renders an app container', () => {
		const { container } = render(Layout);
		expect(container.querySelector('#app')).not.toBeNull();
	});

	it('mounts and unmounts cleanly', () => {
		const { unmount } = render(Layout);
		unmount();
		expect(document.querySelector('#app')).toBeNull();
	});
});