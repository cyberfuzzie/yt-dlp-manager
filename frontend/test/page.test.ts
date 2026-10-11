import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../src/routes/+page.svelte';
import { api, createWebSocket } from '#lib/api.ts';
import type { DownloadInfo } from '#lib/types.ts';
import { makeDownload } from './helpers';
import { setLocale } from '#lib/i18n';

// Mock the API client so the page never performs real network calls.
vi.mock('#lib/api.ts', () => ({
	api: {
		getConfig: vi.fn(),
		getDownloads: vi.fn(),
		getDownload: vi.fn(),
		addDownload: vi.fn(),
		cancelDownload: vi.fn(),
	},
	createWebSocket: vi.fn(),
}));

const apiMock = vi.mocked(api);
const createWebSocketMock = vi.mocked(createWebSocket);

class FakeWebSocket {
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	closed = false;
	close = vi.fn(() => {
		this.closed = true;
	});
}

let currentWs: FakeWebSocket;
let onDownloadMessage: ((download: DownloadInfo) => void) | null = null;

beforeEach(() => {
	setLocale('de');
	currentWs = new FakeWebSocket();
	onDownloadMessage = null;
	createWebSocketMock.mockReset();
	createWebSocketMock.mockImplementation((callback) => {
		onDownloadMessage = callback;
		return currentWs as unknown as WebSocket;
	});
	apiMock.getConfig.mockReset();
	apiMock.getDownloads.mockReset();
	apiMock.addDownload.mockReset();
	apiMock.cancelDownload.mockReset();
});

const urlsLabel = 'Video-URLs * (eine pro Zeile)';

describe('page', () => {
	it('loads the config and downloads and connects the WebSocket on mount', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '/downloads' });
		apiMock.getDownloads.mockResolvedValue([makeDownload({ id: 'd1' })]);

		render(Page);

		await waitFor(() => expect(screen.getByText('Basis-Verzeichnis:')).toBeInTheDocument());
		expect(screen.getByText('/downloads')).toBeInTheDocument();
		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());
		expect(createWebSocketMock).toHaveBeenCalledTimes(1);
		expect(createWebSocketMock).toHaveBeenCalledWith(expect.any(Function));
		expect(screen.getByText('Verbinde...')).toBeInTheDocument();
	});

	it('reflects the WebSocket connection state', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		currentWs.onopen?.();
		await waitFor(() => expect(screen.getByText('Verbunden')).toBeInTheDocument());

		currentWs.onclose?.();
		await waitFor(() => expect(screen.getByText('Getrennt')).toBeInTheDocument());
	});

	it('marks the connection as disconnected on socket errors', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		currentWs.onerror?.();
		await waitFor(() => expect(screen.getByText('Getrennt')).toBeInTheDocument());
	});

	it('applies download updates from the WebSocket', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());
		expect(screen.getByText('Keine Downloads vorhanden')).toBeInTheDocument();

		onDownloadMessage?.(makeDownload({ id: 'd1', status: 'DOWNLOADING', progress: 10 }));
		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());
		expect(screen.getByText('10.0%')).toBeInTheDocument();

		onDownloadMessage?.(makeDownload({ id: 'd1', status: 'DOWNLOADING', progress: 50 }));
		await waitFor(() => expect(screen.getByText('50.0%')).toBeInTheDocument());
		expect(screen.queryByText('10.0%')).not.toBeInTheDocument();
	});

	it('adds downloads through the API', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);
		apiMock.addDownload.mockResolvedValue({ id: 'x', message: 'ok' });

		render(Page);
		await waitFor(() => expect(apiMock.getConfig).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form')!);
		await waitFor(() =>
			expect(apiMock.addDownload).toHaveBeenCalledWith({
				url: 'https://a.example',
				targetDirectory: undefined,
				format: undefined,
				quality: undefined,
			})
		);
	});

	it('alerts when adding downloads fails', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);
		apiMock.addDownload.mockRejectedValue(new Error('boom'));
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(apiMock.getConfig).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Fehler beim Hinzufügen: boom'));
		alertMock.mockRestore();
	});

	it('alerts with a fallback message when the failure is not an Error', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);
		apiMock.addDownload.mockRejectedValue('oops');
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(apiMock.getConfig).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form')!);
		await waitFor(() =>
			expect(alertMock).toHaveBeenCalledWith('Fehler beim Hinzufügen: Unbekannter Fehler')
		);
		alertMock.mockRestore();
	});

	it('cancels a download through the API', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([makeDownload({ id: 'd1', status: 'DOWNLOADING' })]);
		apiMock.cancelDownload.mockResolvedValue({ message: 'ok' });
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());

		await fireEvent.click(screen.getByLabelText('Download abbrechen'));
		await waitFor(() => expect(apiMock.cancelDownload).toHaveBeenCalledWith('d1'));
		expect(alertMock).not.toHaveBeenCalled();
		alertMock.mockRestore();
	});

	it('alerts when cancelling fails', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([makeDownload({ id: 'd1', status: 'PENDING' })]);
		apiMock.cancelDownload.mockRejectedValue(new Error('nope'));
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());

		await fireEvent.click(screen.getByLabelText('Download abbrechen'));
		await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Fehler beim Abbrechen: nope'));
		alertMock.mockRestore();
	});

	it('alerts with a fallback message when cancelling fails with a non-Error', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([makeDownload({ id: 'd1', status: 'PENDING' })]);
		apiMock.cancelDownload.mockRejectedValue('oops');
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());

		await fireEvent.click(screen.getByLabelText('Download abbrechen'));
		await waitFor(() =>
			expect(alertMock).toHaveBeenCalledWith('Fehler beim Abbrechen: Unbekannter Fehler')
		);
		alertMock.mockRestore();
	});

	it('keeps the download list updated when a new download arrives over the socket', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		onDownloadMessage?.(makeDownload({ id: 'n1', status: 'PENDING' }));
		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());
		expect(screen.getByText('Wartend (1)')).toBeInTheDocument();
	});

	it('closes the socket on unmount', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		const { unmount } = render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());
		unmount();
		expect(currentWs.close).toHaveBeenCalled();
	});

	it('logs errors when the initial loading fails', async () => {
		apiMock.getConfig.mockRejectedValue(new Error('cfg'));
		apiMock.getDownloads.mockRejectedValue(new Error('dl'));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(2));
		expect(createWebSocketMock).toHaveBeenCalledTimes(1);
		errorSpy.mockRestore();
	});
});