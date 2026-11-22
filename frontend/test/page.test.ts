import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../src/routes/+page.svelte';
import { api, createWebSocket } from '#lib/api.ts';
import type { ConnectionStatus, WebSocketConnection } from '#lib/api.ts';
import type { DownloadInfo } from '#lib/types.ts';
import { makeDownload } from './helpers';
import { setLocale } from '#lib/i18n.ts';

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

class FakeConnection {
	close = vi.fn();
}

let currentConnection: FakeConnection;
let onDownloadMessage: ((download: DownloadInfo) => void) | null = null;
let onStatusChange: ((status: ConnectionStatus) => void) | null = null;

beforeEach(() => {
	setLocale('de');
	currentConnection = new FakeConnection();
	onDownloadMessage = null;
	onStatusChange = null;
	createWebSocketMock.mockReset();
	createWebSocketMock.mockImplementation((callback, statusCallback) => {
		onDownloadMessage = callback;
		onStatusChange = statusCallback ?? null;
		return currentConnection as unknown as WebSocketConnection;
	});
	apiMock.getConfig.mockReset();
	apiMock.getDownloads.mockReset();
	apiMock.addDownload.mockReset();
	apiMock.cancelDownload.mockReset();
});

afterEach(() => vi.restoreAllMocks());

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
		expect(createWebSocketMock).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
		expect(screen.getByText('Verbinde...')).toBeInTheDocument();
	});

	it('reflects the WebSocket connection state', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		onStatusChange?.('connected');
		await waitFor(() => expect(screen.getByText('Verbunden')).toBeInTheDocument());

		onStatusChange?.('disconnected');
		await waitFor(() => expect(screen.getByText('Getrennt')).toBeInTheDocument());
	});

	it('marks the connection as disconnected on socket errors', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		onStatusChange?.('disconnected');
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
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);
		await waitFor(() =>
			expect(apiMock.addDownload).toHaveBeenCalledWith({
				url: 'https://a.example',
				targetDirectory: undefined,
				format: undefined,
				quality: undefined,
				filenamePattern: undefined,
			})
		);
	});

	it('shows submitted pending downloads immediately from the REST list', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([makeDownload({ id: 'n1', status: 'PENDING', url: 'https://a.example' })]);
		apiMock.addDownload.mockResolvedValue({ id: 'n1', message: 'ok' });

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);

		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());
		expect(screen.getByText('Wartend (1)')).toBeInTheDocument();
		expect(screen.getByText('a.example')).toBeInTheDocument();
		expect(apiMock.getDownloads).toHaveBeenCalledTimes(2);
	});

	it('keeps newer WebSocket state for downloads already in the list', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([makeDownload({ id: 'n1', status: 'PENDING', url: 'https://a.example' })]);
		apiMock.addDownload.mockResolvedValue({ id: 'n1', message: 'ok' });

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		onDownloadMessage?.(makeDownload({ id: 'n1', status: 'DOWNLOADING', url: 'https://a.example', progress: 25 }));
		await waitFor(() => expect(screen.getByText('25.0%')).toBeInTheDocument());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);

		await waitFor(() => expect(apiMock.getDownloads).toHaveBeenCalledTimes(2));
		expect(screen.getByText('Downloads (1)')).toBeInTheDocument();
		expect(screen.queryByText('Wartend (1)')).not.toBeInTheDocument();
		expect(screen.getByText('25.0%')).toBeInTheDocument();
	});

	it('logs a failed refresh after adding without reporting an add error', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error('refresh'));
		apiMock.addDownload.mockResolvedValue({ id: 'n1', message: 'ok' });
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);

		await waitFor(() =>
			expect(errorSpy).toHaveBeenCalledWith('Failed to load downloads after adding:', expect.any(Error))
		);
		expect(alertMock).not.toHaveBeenCalled();
		alertMock.mockRestore();
		errorSpy.mockRestore();
	});

	it('keeps submitted downloads when the initial load resolves late', async () => {
		let resolveInitial!: (value: DownloadInfo[]) => void;
		const initialLoad = new Promise<DownloadInfo[]>(resolve => { resolveInitial = resolve; });
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads
			.mockReturnValueOnce(initialLoad)
			.mockResolvedValueOnce([makeDownload({ id: 'n1', status: 'PENDING', url: 'https://a.example' })]);
		apiMock.addDownload.mockResolvedValue({ id: 'n1', message: 'ok' });

		render(Page);
		await waitFor(() => expect(apiMock.getDownloads).toHaveBeenCalledTimes(1));

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);

		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());
		resolveInitial([]);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		expect(screen.getByText('Downloads (1)')).toBeInTheDocument();
		expect(screen.getByText('Wartend (1)')).toBeInTheDocument();
	});

	it('does not overwrite a socket update that arrives before the refresh resolves', async () => {
		let resolveRefresh!: (value: DownloadInfo[]) => void;
		const refresh = new Promise<DownloadInfo[]>(resolve => { resolveRefresh = resolve; });
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads
			.mockResolvedValueOnce([])
			.mockReturnValueOnce(refresh);
		apiMock.addDownload
			.mockResolvedValueOnce({ id: 'n1', message: 'ok' })
			.mockResolvedValueOnce({ id: 'n2', message: 'ok' });

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), {
			target: { value: 'https://a.example\nhttps://b.example' },
		});
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);
		await waitFor(() => expect(apiMock.getDownloads).toHaveBeenCalledTimes(2));

		onDownloadMessage?.(makeDownload({ id: 'n1', status: 'DOWNLOADING', progress: 40 }));
		await waitFor(() => expect(screen.getByText('40.0%')).toBeInTheDocument());

		// The stale REST copy of n1 must not replace the socket update, while n2 is added.
		resolveRefresh([
			makeDownload({ id: 'n1', status: 'PENDING', url: 'https://a.example' }),
			makeDownload({ id: 'n2', status: 'PENDING', url: 'https://b.example' }),
		]);
		await waitFor(() => expect(screen.getByText('b.example')).toBeInTheDocument());

		expect(screen.getByText('Downloads (2)')).toBeInTheDocument();
		expect(screen.getByText('example.com')).toBeInTheDocument();
		expect(screen.queryByText('a.example')).not.toBeInTheDocument();
		expect(screen.getByText('40.0%')).toBeInTheDocument();
	});

	it('shows successful submissions when another URL in the batch fails', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([makeDownload({ id: 'ok-1', status: 'PENDING', url: 'https://a.example' })]);
		apiMock.addDownload
			.mockResolvedValueOnce({ id: 'ok-1', message: 'ok' })
			.mockRejectedValueOnce(new Error('bad url'));
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), {
			target: { value: 'https://a.example\nhttps://b.example' },
		});
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);

		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());
		expect(screen.getByText('Wartend (1)')).toBeInTheDocument();
		expect(alertMock).toHaveBeenCalledWith('Fehler beim Hinzufügen: bad url');
	});

	it('ignores unrelated downloads returned by the refresh request', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				makeDownload({ id: 'other', status: 'PENDING', url: 'https://other.example' }),
				makeDownload({ id: 'n1', status: 'PENDING', url: 'https://a.example' }),
			]);
		apiMock.addDownload.mockResolvedValue({ id: 'n1', message: 'ok' });

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);

		await waitFor(() => expect(screen.getByText('Downloads (1)')).toBeInTheDocument());
		expect(screen.queryByText('other.example')).not.toBeInTheDocument();
	});

	it('alerts when adding downloads fails', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);
		apiMock.addDownload.mockRejectedValue(new Error('boom'));
		const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

		render(Page);
		await waitFor(() => expect(apiMock.getConfig).toHaveBeenCalled());

		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);
		await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Fehler beim Hinzufügen: boom'));
		expect(apiMock.getDownloads).toHaveBeenCalledTimes(1);
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
		await fireEvent.submit(document.querySelector('form') as HTMLFormElement);
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
		expect(currentConnection.close).toHaveBeenCalled();
	});

	it('does not open a socket if unmounted before loading finishes', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		const { unmount } = render(Page);
		unmount();
		await waitFor(() => expect(apiMock.getDownloads).toHaveBeenCalled());

		expect(createWebSocketMock).not.toHaveBeenCalled();
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

	it('switches connection label when locale changes after render', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(createWebSocketMock).toHaveBeenCalled());
		onStatusChange?.('connected');
		await waitFor(() => expect(screen.getByText('Verbunden')).toBeInTheDocument());

		setLocale('en');
		await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());

		setLocale('de');
	});

	it('switches form labels when locale changes after render', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(screen.getByText('Neue Downloads hinzufügen')).toBeInTheDocument());

		setLocale('en');
		await waitFor(() => expect(screen.getByText('Add New Downloads')).toBeInTheDocument());

		setLocale('de');
	});

	it('switches base-directory label when locale changes after render', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '/downloads' });
		apiMock.getDownloads.mockResolvedValue([]);

		render(Page);
		await waitFor(() => expect(screen.getByText('Basis-Verzeichnis:')).toBeInTheDocument());

		setLocale('en');
		await waitFor(() => expect(screen.getByText('Base Directory:')).toBeInTheDocument());

		setLocale('de');
	});

	it('switches status labels when locale changes after render', async () => {
		apiMock.getConfig.mockResolvedValue({ baseDirectory: '' });
		apiMock.getDownloads.mockResolvedValue([makeDownload({ id: 'd1', status: 'PENDING' })]);

		render(Page);
		await waitFor(() => expect(screen.getByText('Wartend (1)')).toBeInTheDocument());

		setLocale('en');
		await waitFor(() => expect(screen.getByText('Pending (1)')).toBeInTheDocument());

		setLocale('de');
	});
});