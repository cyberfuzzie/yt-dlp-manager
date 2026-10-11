import { describe, expect, it, beforeEach } from 'vitest';
import StatusBadge from '#lib/components/StatusBadge.svelte';
import { getLocale, setLocale } from '#lib/i18n.ts';
import type { DownloadStatus } from '#lib/types.ts';
import { render, screen } from '@testing-library/svelte';

const statuses: DownloadStatus[] = ['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'];

describe('StatusBadge', () => {
	beforeEach(() => setLocale('de'));

	it('renders a label and title for every status', () => {
		const locale = getLocale();
		for (const status of statuses) {
			const { unmount } = render(StatusBadge, { props: { status } });
			const expectedLabel = locale === 'de'
				? { PENDING: 'Wartend', DOWNLOADING: 'Läuft', COMPLETED: 'Abgeschlossen', FAILED: 'Fehlgeschlagen', CANCELLED: 'Abgebrochen' }[status]
				: { PENDING: 'Pending', DOWNLOADING: 'Downloading', COMPLETED: 'Completed', FAILED: 'Failed', CANCELLED: 'Cancelled' }[status];
			expect(screen.getByText(expectedLabel)).toBeInTheDocument();
			expect(screen.getByTitle(expectedLabel)).toBeInTheDocument();
			unmount();
		}
	});

	it('hides the label when showLabel is false', () => {
		const locale = getLocale();
		const expectedLabel = locale === 'de' ? 'Abgeschlossen' : 'Completed';
		const { unmount } = render(StatusBadge, { props: { status: 'COMPLETED', showLabel: false } });
		expect(screen.queryByText(expectedLabel)).not.toBeInTheDocument();
		expect(screen.getByTitle(expectedLabel)).toBeInTheDocument();
		unmount();
	});

	it('renders English labels when locale is English', () => {
		setLocale('en');
		for (const status of statuses) {
			const { unmount } = render(StatusBadge, { props: { status } });
			const enLabels = { PENDING: 'Pending', DOWNLOADING: 'Downloading', COMPLETED: 'Completed', FAILED: 'Failed', CANCELLED: 'Cancelled' };
			expect(screen.getByText(enLabels[status])).toBeInTheDocument();
			unmount();
		}
		setLocale('de');
	});
});
