import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import StatusBadge from '#lib/components/StatusBadge.svelte';
import { getLocale, setLocale } from '#lib/i18n';
import { getStatusLabels } from '#lib/i18n/translations.ts';
import type { DownloadStatus } from '#lib/types.ts';

const statuses: DownloadStatus[] = ['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'];

describe('StatusBadge', () => {
	beforeEach(() => setLocale('de'));

	it('renders a label and title for every status', () => {
		const labels = getStatusLabels(getLocale());
		for (const status of statuses) {
			const { unmount } = render(StatusBadge, { props: { status } });
			expect(screen.getByText(labels[status])).toBeInTheDocument();
			expect(screen.getByTitle(labels[status])).toBeInTheDocument();
			unmount();
		}
	});

	it('hides the label when showLabel is false', () => {
		const labels = getStatusLabels(getLocale());
		const { unmount } = render(StatusBadge, { props: { status: 'COMPLETED', showLabel: false } });
		expect(screen.queryByText(labels.COMPLETED)).not.toBeInTheDocument();
		expect(screen.getByTitle(labels.COMPLETED)).toBeInTheDocument();
		unmount();
	});
});