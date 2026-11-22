import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DownloadList from '#lib/components/DownloadList.svelte';
import { STATUS_COLORS } from '#lib/types.ts';
import { setLocale, unwrapT } from '#lib/i18n.ts';
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
					makeDownload({ id: 'c1', status: 'COMPLETED', createdAt: '2026-01-01T10:00:00Z', url: 'https://c1.example/v' }),
					makeDownload({ id: 'x1', status: 'CANCELLED', createdAt: '2026-01-01T10:00:00Z', url: 'https://x1.example/v' }),
					makeDownload({ id: 'f1', status: 'FAILED', createdAt: '2026-01-01T10:00:00Z', url: 'https://f1.example/v' }),
					makeDownload({ id: 'p1', status: 'PENDING', createdAt: '2026-01-01T09:00:00Z', url: 'https://p1.example/v' }),
					makeDownload({ id: 'p2', status: 'PENDING', createdAt: '2026-01-01T11:00:00Z', url: 'https://p2.example/v' }),
					makeDownload({ id: 'd1', status: 'DOWNLOADING', createdAt: '2026-01-01T10:00:00Z', url: 'https://d1.example/v' }),
				],
				onCancel: vi.fn(),
			},
		});

		expect(screen.getByText('Downloads (6)')).toBeInTheDocument();
		expect(screen.getByRole('group', { name: unwrapT('downloadList.filters') })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Läuft: 1' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Wartend: 2' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Fehlgeschlagen: 1' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Abgeschlossen: 1' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Abgebrochen: 1' })).toBeInTheDocument();

		// Running downloads first, then pending, failed, completed and cancelled.
		const headings = screen.getAllByRole('heading', { level: 4 });
		expect(headings.map((h) => h.textContent?.trim())).toEqual([
			'Läuft (1)',
			'Wartend (2)',
			'Fehlgeschlagen (1)',
			'Abgeschlossen (1)',
			'Abgebrochen (1)',
		]);

		// Items within a status are sorted by createdAt, newest first.
		const articles = document.querySelectorAll('article.download-item');
		expect(articles).toHaveLength(6);
		expect(articles[0].textContent).toContain('d1.example');
		expect(articles[1].textContent).toContain('p2.example');
		expect(articles[2].textContent).toContain('p1.example');
	});

	it('forwards cancel events from items', async () => {
		const onCancel = vi.fn();
		render(DownloadList, {
			props: { downloads: [makeDownload({ status: 'DOWNLOADING' })], onCancel },
		});
		await fireEvent.click(screen.getByLabelText('Download abbrechen'));
		expect(onCancel).toHaveBeenCalledWith('id-1');
	});

	it('colours the filter pills via the status map', () => {
		render(DownloadList, {
			props: { downloads: [makeDownload({ status: 'FAILED' })], onCancel: vi.fn() },
		});
		const pill = screen.getByRole('button', { name: 'Fehlgeschlagen: 1' });
		expect(pill).toBeInTheDocument();
		expect(pill).toHaveStyle(`--status-color: ${STATUS_COLORS.FAILED}`);
	});

	it('toggles the visibility of a status bucket and keeps its count', async () => {
		render(DownloadList, {
			props: {
				downloads: [
					makeDownload({ id: 'p1', status: 'PENDING' }),
					makeDownload({ id: 'c1', status: 'COMPLETED' }),
				],
				onCancel: vi.fn(),
			},
		});

		const pendingPill = screen.getByRole('button', { name: 'Wartend: 1' });
		// Pressed means the filter is active, i.e. that bucket is hidden.
		expect(pendingPill).toHaveAttribute('aria-pressed', 'false');
		expect(pendingPill).toHaveAttribute(
			'title',
			unwrapT('downloadList.hideStatus', { status: 'Wartend' })
		);
		const hint = screen.getByText(unwrapT('downloadList.filterHint'));
		expect(hint).toHaveAttribute('id', 'download-filter-hint');
		expect(pendingPill).toHaveAttribute('aria-describedby', hint.id);

		await fireEvent.click(pendingPill);
		expect(pendingPill).toHaveAttribute('aria-pressed', 'true');
		expect(pendingPill).toHaveAttribute(
			'title',
			unwrapT('downloadList.showStatus', { status: 'Wartend' })
		);
		expect(pendingPill).toHaveClass('filtered-out');
		expect(screen.queryByText('Wartend (1)')).not.toBeInTheDocument();
		expect(screen.getByText('Abgeschlossen (1)')).toBeInTheDocument();
		expect(screen.getByText('Wartend: 1')).toBeInTheDocument();
		expect(document.querySelectorAll('article.download-item')).toHaveLength(1);

		await fireEvent.click(pendingPill);
		expect(pendingPill).toHaveAttribute('aria-pressed', 'false');
		expect(pendingPill).not.toHaveClass('filtered-out');
		expect(screen.getByText('Wartend (1)')).toBeInTheDocument();
		expect(document.querySelectorAll('article.download-item')).toHaveLength(2);
	});

	it('toggles status buckets independently', async () => {
		render(DownloadList, {
			props: {
				downloads: [
					makeDownload({ id: 'd1', status: 'DOWNLOADING' }),
					makeDownload({ id: 'p1', status: 'PENDING' }),
					makeDownload({ id: 'f1', status: 'FAILED' }),
				],
				onCancel: vi.fn(),
			},
		});

		const runningPill = screen.getByRole('button', { name: 'Läuft: 1' });
		const pendingPill = screen.getByRole('button', { name: 'Wartend: 1' });
		await fireEvent.click(runningPill);
		await fireEvent.click(pendingPill);

		expect(runningPill).toHaveAttribute('aria-pressed', 'true');
		expect(pendingPill).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText('Fehlgeschlagen (1)')).toBeInTheDocument();
		expect(screen.queryByText('Läuft (1)')).not.toBeInTheDocument();
		expect(screen.queryByText('Wartend (1)')).not.toBeInTheDocument();

		await fireEvent.click(runningPill);
		expect(runningPill).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByText('Läuft (1)')).toBeInTheDocument();
		expect(screen.queryByText('Wartend (1)')).not.toBeInTheDocument();
	});

	it('offers a reset when every status is hidden', async () => {
		render(DownloadList, {
			props: {
				downloads: [
					makeDownload({ id: 'd1', status: 'DOWNLOADING' }),
					makeDownload({ id: 'c1', status: 'COMPLETED' }),
				],
				onCancel: vi.fn(),
			},
		});

		const liveRegion = screen.getByRole('status');
		expect(liveRegion).toHaveTextContent('');

		await fireEvent.click(screen.getByRole('button', { name: 'Läuft: 1' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Abgeschlossen: 1' }));

		expect(liveRegion).toHaveTextContent(unwrapT('downloadList.allHidden'));
		expect(document.querySelectorAll('article.download-item')).toHaveLength(0);
		expect(screen.getByText('Downloads (2)')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: unwrapT('downloadList.showAll') }));
		expect(screen.getByText('Läuft (1)')).toBeInTheDocument();
		expect(screen.getByText('Abgeschlossen (1)')).toBeInTheDocument();
		expect(liveRegion).toHaveTextContent('');
		expect(document.querySelectorAll('article.download-item')).toHaveLength(2);
	});

	it('keeps the active filters when the downloads prop changes', async () => {
		const { rerender } = render(DownloadList, {
			props: {
				downloads: [makeDownload({ id: 'p1', status: 'PENDING' })],
				onCancel: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Wartend: 1' }));
		await rerender({
			downloads: [
				makeDownload({ id: 'p1', status: 'PENDING' }),
				makeDownload({ id: 'p2', status: 'PENDING' }),
				makeDownload({ id: 'f1', status: 'FAILED' }),
			],
			onCancel: vi.fn(),
		});

		expect(screen.getByText('Downloads (3)')).toBeInTheDocument();
		expect(screen.getByText('Wartend: 2')).toHaveAttribute('aria-pressed', 'true');
		expect(screen.queryByText('Wartend (2)')).not.toBeInTheDocument();
		expect(screen.getByText('Fehlgeschlagen (1)')).toBeInTheDocument();
	});

	it('drops a filter once its bucket becomes empty', async () => {
		const { rerender } = render(DownloadList, {
			props: {
				downloads: [makeDownload({ id: 'p1', status: 'PENDING' })],
				onCancel: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Wartend: 1' }));
		expect(screen.getByText('Wartend: 1')).toHaveAttribute('aria-pressed', 'true');

		// The pending item finishes: its filter is released so future pending items are visible.
		await rerender({
			downloads: [makeDownload({ id: 'p1', status: 'DOWNLOADING' })],
			onCancel: vi.fn(),
		});
		expect(screen.getByText('Läuft (1)')).toBeInTheDocument();

		await rerender({
			downloads: [
				makeDownload({ id: 'p1', status: 'DOWNLOADING' }),
				makeDownload({ id: 'p2', status: 'PENDING' }),
			],
			onCancel: vi.fn(),
		});
		expect(screen.getByText('Wartend (1)')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Wartend: 1' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('localises filter tooltips in the active locale', async () => {
		setLocale('en');
		render(DownloadList, {
			props: {
				downloads: [makeDownload({ id: 'x1', status: 'CANCELLED' })],
				onCancel: vi.fn(),
			},
		});

		const pill = screen.getByRole('button', { name: 'Cancelled: 1' });
		expect(pill).toHaveAttribute(
			'title',
			unwrapT('downloadList.hideStatus', { status: 'Cancelled' })
		);

		await fireEvent.click(pill);
		expect(pill).toHaveAttribute(
			'title',
			unwrapT('downloadList.showStatus', { status: 'Cancelled' })
		);
		setLocale('de');
	});

	it('keeps focus in the filter group when the focused pill disappears', async () => {
		const { rerender } = render(DownloadList, {
			props: {
				downloads: [
					makeDownload({ id: 'd1', status: 'DOWNLOADING' }),
					makeDownload({ id: 'p1', status: 'PENDING' }),
				],
				onCancel: vi.fn(),
			},
		});

		const runningPill = screen.getByRole('button', { name: 'Läuft: 1' });
		runningPill.focus();
		expect(document.activeElement).toBe(runningPill);

		await rerender({
			downloads: [makeDownload({ id: 'p1', status: 'PENDING' })],
			onCancel: vi.fn(),
		});

		const pendingPill = screen.getByRole('button', { name: 'Wartend: 1' });
		await waitFor(() => expect(document.activeElement).toBe(pendingPill));
	});

	it('does not restore focus after the focused pill is blurred', async () => {
		const { rerender } = render(DownloadList, {
			props: {
				downloads: [
					makeDownload({ id: 'd1', status: 'DOWNLOADING' }),
					makeDownload({ id: 'p1', status: 'PENDING' }),
				],
				onCancel: vi.fn(),
			},
		});

		const runningPill = screen.getByRole('button', { name: 'Läuft: 1' });
		const pendingPill = screen.getByRole('button', { name: 'Wartend: 1' });
		runningPill.focus();
		pendingPill.focus();

		await rerender({
			downloads: [makeDownload({ id: 'p1', status: 'PENDING' })],
			onCancel: vi.fn(),
		});

		expect(document.activeElement).toBe(pendingPill);
	});
});
