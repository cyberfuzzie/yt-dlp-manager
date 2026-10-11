import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DownloadList from '#lib/components/DownloadList.svelte';
import { setLocale } from '#lib/i18n';
import { makeDownload } from '../helpers';

describe('DownloadList', () => {
	beforeEach(() => setLocale('de'));

	it('shows an empty state when there are no downloads', () => {
		render(DownloadList, { props: { downloads: [], onCancel: vi.fn() } });
		expect(screen.getByText('Keine Downloads vorhanden')).toBeInTheDocument();
	});

	it('groups and counts downloads by status in the defined order', () => {
		render(DownloadList, {
			props: {
				downloads: [
					makeDownload({ id: 'c1', status: 'COMPLETED', createdAt: '2026-01-01T10:00:00Z' }),
					makeDownload({ id: 'p1', status: 'PENDING', createdAt: '2026-01-01T09:00:00Z', url: 'https://p1.example/v' }),
					makeDownload({ id: 'p2', status: 'PENDING', createdAt: '2026-01-01T11:00:00Z', url: 'https://p2.example/v' }),
				],
				onCancel: vi.fn(),
			},
		});

		expect(screen.getByText('Downloads (3)')).toBeInTheDocument();
		expect(screen.getByText('Wartend: 2')).toBeInTheDocument();
		expect(screen.getByText('Abgeschlossen: 1')).toBeInTheDocument();

		// Sections appear in STATUS_LABELS order, only non-empty ones.
		const headings = screen.getAllByRole('heading', { level: 4 });
		expect(headings.map((h) => h.textContent?.trim())).toEqual(['Wartend (2)', 'Abgeschlossen (1)']);
		expect(screen.getByText('Wartend (2)')).toBeInTheDocument();
		expect(screen.getByText('Abgeschlossen (1)')).toBeInTheDocument();

		// Items within a status are sorted by createdAt, newest first.
		const articles = document.querySelectorAll('article.download-item');
		expect(articles[0].textContent).toContain('p2.example');
		expect(articles[1].textContent).toContain('p1.example');
	});

	it('forwards cancel events from items', async () => {
		const onCancel = vi.fn();
		render(DownloadList, {
			props: { downloads: [makeDownload({ status: 'DOWNLOADING' })], onCancel },
		});
		await fireEvent.click(screen.getByLabelText('Download abbrechen'));
		expect(onCancel).toHaveBeenCalledWith('id-1');
	});

	it('colours the summary chips via the status map', () => {
		render(DownloadList, {
			props: { downloads: [makeDownload({ status: 'FAILED' })], onCancel: vi.fn() },
		});
		const chip = within(screen.getByText('Fehlgeschlagen: 1'));
		expect(chip.getByText('Fehlgeschlagen: 1')).toBeInTheDocument();
		expect(screen.getByText('Fehlgeschlagen: 1')).toHaveStyle('--status-color: #ef4444');
	});
});