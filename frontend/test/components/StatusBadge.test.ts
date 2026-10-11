import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import StatusBadge from '#lib/components/StatusBadge.svelte';
import { STATUS_LABELS } from '#lib/types.ts';
import type { DownloadStatus } from '#lib/types.ts';

const statuses: DownloadStatus[] = ['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'];

describe('StatusBadge', () => {
	it('renders a label and title for every status', () => {
		for (const status of statuses) {
			const { unmount } = render(StatusBadge, { props: { status } });
			expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
			expect(screen.getByTitle(STATUS_LABELS[status])).toBeInTheDocument();
			unmount();
		}
	});

	it('hides the label when showLabel is false', () => {
		const { unmount } = render(StatusBadge, { props: { status: 'COMPLETED', showLabel: false } });
		expect(screen.queryByText(STATUS_LABELS.COMPLETED)).not.toBeInTheDocument();
		expect(screen.getByTitle(STATUS_LABELS.COMPLETED)).toBeInTheDocument();
		unmount();
	});
});