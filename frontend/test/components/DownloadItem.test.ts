import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DownloadItem from '#lib/components/DownloadItem.svelte';
import { setLocale } from '#lib/i18n';
import type { DownloadInfo } from '#lib/types.ts';
import { makeDownload } from '../helpers';

function stubClipboard() {
	const writeText = vi.fn().mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText },
	});
	return writeText;
}

function renderItem(download: DownloadInfo = makeDownload(), onCancel: (id: string) => void = vi.fn()) {
	return render(DownloadItem, { props: { download, onCancel } });
}

describe('DownloadItem', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows domain, URL, created time and a cancel button for a pending download', () => {
		renderItem(
			makeDownload({
				url: 'https://www.youtube.com/watch?v=abc123',
				createdAt: '2026-01-01T12:00:00Z',
			})
		);
		expect(screen.getByText('youtube.com')).toBeInTheDocument();
		expect(screen.getByText('https://www.youtube.com/watch?v=abc123')).toBeInTheDocument();
		expect(screen.getByText('Hinzugefügt: gerade eben')).toBeInTheDocument();
		expect(screen.getByLabelText('Download abbrechen')).toBeInTheDocument();
	});

	it('shows the target directory in the header when present', () => {
		renderItem(makeDownload({ targetDirectory: '/media/videos' }));
		expect(screen.getByText('📁 /media/videos')).toBeInTheDocument();
	});

	it('calls onCancel and disables the button', async () => {
		const onCancel = vi.fn();
		renderItem(makeDownload({ status: 'DOWNLOADING' }), onCancel);
		const button = screen.getByLabelText('Download abbrechen');
		await fireEvent.click(button);
		expect(onCancel).toHaveBeenCalledWith('id-1');
		expect(button).toBeDisabled();
	});

	it('toggles the details panel', async () => {
		renderItem(
			makeDownload({
				targetDirectory: '/media',
				format: 'bestvideo+bestaudio',
				quality: '1080',
				startedAt: '2026-01-01T12:01:00Z',
				completedAt: '2026-01-01T12:05:00Z',
			})
		);
		expect(screen.getByLabelText('Details anzeigen')).toBeInTheDocument();
		await fireEvent.click(screen.getByLabelText('Details anzeigen'));
		expect(screen.getByLabelText('Details ausblenden')).toBeInTheDocument();
		expect(screen.getByText('ID:')).toBeInTheDocument();
		expect(screen.getByText('URL:')).toBeInTheDocument();
		expect(screen.getByText('Zielverzeichnis:')).toBeInTheDocument();
		expect(screen.getByText('Format:')).toBeInTheDocument();
		expect(screen.getByText('Qualität:')).toBeInTheDocument();
		expect(screen.getByText('Erstellt:')).toBeInTheDocument();
		expect(screen.getByText('Gestartet:')).toBeInTheDocument();
		expect(screen.getByText('Beendet:')).toBeInTheDocument();
		await fireEvent.click(screen.getByLabelText('Details ausblenden'));
		expect(screen.getByLabelText('Details anzeigen')).toBeInTheDocument();
	});

	it('shows progress, speed and ETA while downloading', () => {
		renderItem(
			makeDownload({
				status: 'DOWNLOADING',
				progress: 42.5,
				speed: '1.0MiB/s',
				eta: '00:10',
			})
		);
		expect(screen.getByText('42.5%')).toBeInTheDocument();
		expect(screen.getByText('⚡ 1.0MiB/s')).toBeInTheDocument();
		expect(screen.getByText('⏱ 00:10')).toBeInTheDocument();
		const bar = document.querySelector('.progress-bar');
		expect(bar).toHaveStyle('width: 42.5%');
	});

	it('handles a DOWNLOADING download without a progress field', () => {
		renderItem({
			id: '080db9f7-ad4b-4a8b-847c-83994216a6a6',
			url: 'https://www.youtube.com/watch?v=q5atySVMQDc',
			targetDirectory: null,
			format: null,
			quality: null,
			status: 'DOWNLOADING',
			progress: undefined as unknown as number,
			speed: null,
			eta: null,
			filename: null,
			fileSize: null,
			errorMessage: null,
			createdAt: '2026-10-11T15:59:30.497333442Z',
			startedAt: '2026-10-11T15:59:30.497757165Z',
			completedAt: null,
		});
		expect(screen.getByText('0.0%')).toBeInTheDocument();
	});

	it('shows the filename and size for a completed download', () => {
		renderItem(
			makeDownload({
				status: 'COMPLETED',
				filename: 'video.mp4',
				fileSize: 10 * 1024 * 1024,
			})
		);
		expect(screen.getByText('📄 video.mp4')).toBeInTheDocument();
		expect(screen.getByText('10 MB')).toBeInTheDocument();
	});

	it('renders a completed download without a filename without a body', () => {
		renderItem(makeDownload({ status: 'COMPLETED', filename: null }));
		expect(screen.queryByText(/📄/)).not.toBeInTheDocument();
	});

	it('shows the error message and copies the URL', async () => {
		const writeText = stubClipboard();
		renderItem(
			makeDownload({
				status: 'FAILED',
				errorMessage: 'Unsupported URL',
				url: 'https://example.com/failed',
			})
		);
		expect(screen.getByText('Unsupported URL')).toBeInTheDocument();
		await fireEvent.click(screen.getByTitle('URL kopieren'));
		expect(writeText).toHaveBeenCalledWith('https://example.com/failed');
	});

	it('renders a failed download without an error message without a body', () => {
		renderItem(makeDownload({ status: 'FAILED', errorMessage: null }));
		expect(screen.queryByText('⚠')).not.toBeInTheDocument();
	});

	it('renders cancelled downloads without action buttons', () => {
		renderItem(makeDownload({ status: 'CANCELLED' }));
		expect(screen.queryByLabelText('Download abbrechen')).not.toBeInTheDocument();
		expect(screen.getByText('▼')).toBeInTheDocument();
	});
});