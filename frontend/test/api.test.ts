import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, createWebSocket } from '#lib/api.ts';
import type { ConnectionStatus, WebSocketConnection } from '#lib/api.ts';
import { makeDownload } from './helpers';

function jsonResponse(body: unknown, ok = true, status = 200, statusText = 'OK') {
	return {
		ok,
		status,
		statusText,
		json: () => Promise.resolve(body),
	} as unknown as Response;
}

describe('api', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getConfig fetches the config endpoint', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ baseDirectory: '/downloads' }));
		await expect(api.getConfig()).resolves.toEqual({ baseDirectory: '/downloads' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/config');
		expect(init).toMatchObject({ headers: { 'Content-Type': 'application/json' } });
	});

	it('getDownloads fetches the downloads endpoint', async () => {
		const downloads = [makeDownload()];
		fetchMock.mockResolvedValue(jsonResponse(downloads));
		await expect(api.getDownloads()).resolves.toEqual(downloads);
		expect(fetchMock.mock.calls[0][0]).toBe('/api/downloads');
	});

	it('getDownload fetches a single download by id', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ id: 'd1' }));
		await expect(api.getDownload('d1')).resolves.toEqual({ id: 'd1' });
		expect(fetchMock.mock.calls[0][0]).toBe('/api/downloads/d1');
	});

	it('addDownload POSTs the request as JSON', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ id: 'd1', message: 'ok' }));
		await expect(api.addDownload({ url: 'https://example.com/v' })).resolves.toEqual({ id: 'd1', message: 'ok' });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/downloads');
		expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ url: 'https://example.com/v' }) });
	});

	it('cancelDownload DELETEs the download', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ message: 'ok' }));
		await expect(api.cancelDownload('d1')).resolves.toEqual({ message: 'ok' });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/downloads/d1');
		expect(init).toMatchObject({ method: 'DELETE' });
	});

	it('throws the server message on failure', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ message: 'Bad URL' }, false, 400, 'Bad Request'));
		await expect(api.getConfig()).rejects.toThrow('Bad URL');
	});

	it('falls back to the HTTP status text when the body is not JSON', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			json: () => Promise.reject(new Error('not json')),
		} as unknown as Response);
		await expect(api.getConfig()).rejects.toThrow('Internal Server Error');
	});

	it('falls back to the HTTP status when the body has no message', async () => {
		fetchMock.mockResolvedValue(jsonResponse({}, false, 418, ''));
		await expect(api.getConfig()).rejects.toThrow('HTTP 418');
	});
});

type Listener = (event?: unknown) => void;

class FakeWebSocket {
	static instances: FakeWebSocket[] = [];
	private listeners = new Map<string, Listener[]>();
	close = vi.fn(() => this.dispatch('close'));

	constructor(public url: string) {
		FakeWebSocket.instances.push(this);
	}

	addEventListener(type: string, listener: Listener): void {
		const listeners = this.listeners.get(type) ?? [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	}

	dispatch(type: string, event: unknown = {}): void {
		for (const listener of this.listeners.get(type) ?? []) listener(event);
	}
}

describe('createWebSocket', () => {
	const onMessage = vi.fn();

	beforeEach(() => {
		FakeWebSocket.instances = [];
		onMessage.mockReset();
		vi.stubGlobal('WebSocket', FakeWebSocket);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('connects to a ws:// endpoint and routes download updates', () => {
		createWebSocket(onMessage);
		expect(FakeWebSocket.instances).toHaveLength(1);
		const ws = FakeWebSocket.instances[0];
		expect(ws.url.startsWith('ws://')).toBe(true);
		expect(ws.url.endsWith('/api/ws')).toBe(true);

		const download = makeDownload();
		ws.dispatch('message', { data: JSON.stringify({ type: 'download_update', payload: download }) });
		expect(onMessage).toHaveBeenCalledWith(download);
	});

	it('ignores message types that are not download updates', () => {
		createWebSocket(onMessage);
		FakeWebSocket.instances[0].dispatch('message', { data: JSON.stringify({ type: 'other', payload: {} }) });
		expect(onMessage).not.toHaveBeenCalled();
	});

	it('silently ignores malformed messages', () => {
		createWebSocket(onMessage);
		FakeWebSocket.instances[0].dispatch('message', { data: 'not json' });
		expect(onMessage).not.toHaveBeenCalled();
	});

	it('silently handles WebSocket errors', () => {
		createWebSocket(onMessage);
		expect(() => FakeWebSocket.instances[0].dispatch('error', {})).not.toThrow();
	});

	it('reports connection status changes', () => {
		const onStatusChange = vi.fn();
		createWebSocket(onMessage, onStatusChange);
		expect(onStatusChange).toHaveBeenLastCalledWith('connecting');

		const ws = FakeWebSocket.instances[0];
		ws.dispatch('open');
		expect(onStatusChange).toHaveBeenLastCalledWith('connected');
		ws.dispatch('error');
		expect(onStatusChange).toHaveBeenLastCalledWith('disconnected');
		ws.dispatch('close');
		expect(onStatusChange).toHaveBeenLastCalledWith('disconnected');
	});

	it('uses wss:// when the page is served over https', () => {
		const original = Object.getOwnPropertyDescriptor(window, 'location');
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { protocol: 'https:', host: 'example.test' },
		});
		try {
			createWebSocket(onMessage);
			expect(FakeWebSocket.instances[0].url).toBe('wss://example.test/api/ws');
		} finally {
			if (original) {
				Object.defineProperty(window, 'location', original);
			} else {
				Reflect.deleteProperty(window, 'location');
			}
		}
	});

	it('reconnects after an unexpected close and keeps routing updates', () => {
		vi.useFakeTimers();
		createWebSocket(onMessage);
		FakeWebSocket.instances[0].dispatch('close');
		expect(vi.getTimerCount()).toBe(1);

		vi.advanceTimersByTime(999);
		expect(FakeWebSocket.instances).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(FakeWebSocket.instances).toHaveLength(2);

		const download = makeDownload();
		FakeWebSocket.instances[1].dispatch('message', {
			data: JSON.stringify({ type: 'download_update', payload: download }),
		});
		expect(onMessage).toHaveBeenCalledWith(download);
	});

	it('backs off on repeated failures and resets the delay after a successful connection', () => {
		vi.useFakeTimers();
		createWebSocket(onMessage);

		FakeWebSocket.instances[0].dispatch('close');
		vi.advanceTimersByTime(1_000);
		FakeWebSocket.instances[1].dispatch('close');
		vi.advanceTimersByTime(2_000);
		expect(FakeWebSocket.instances).toHaveLength(3);

		FakeWebSocket.instances[2].dispatch('open');
		FakeWebSocket.instances[2].dispatch('close');
		vi.advanceTimersByTime(1_000);
		expect(FakeWebSocket.instances).toHaveLength(4);
	});

	it('ignores events from a socket that has already been replaced', () => {
		vi.useFakeTimers();
		const onStatusChange = vi.fn();
		createWebSocket(onMessage, onStatusChange);
		const stale = FakeWebSocket.instances[0];
		stale.dispatch('close');
		vi.advanceTimersByTime(1_000);
		expect(FakeWebSocket.instances).toHaveLength(2);

		onMessage.mockClear();
		onStatusChange.mockClear();
		stale.dispatch('message', { data: JSON.stringify({ type: 'download_update', payload: makeDownload() }) });
		stale.dispatch('open');
		stale.dispatch('error');
		stale.dispatch('close');

		expect(onMessage).not.toHaveBeenCalled();
		expect(onStatusChange).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not reconnect when the connection is closed explicitly', () => {
		vi.useFakeTimers();
		const onStatusChange = vi.fn();
		const connection = createWebSocket(onMessage, onStatusChange);
		connection.close();

		expect(FakeWebSocket.instances[0].close).toHaveBeenCalled();
		expect(onStatusChange).toHaveBeenLastCalledWith('disconnected');
		vi.advanceTimersByTime(60_000);
		expect(FakeWebSocket.instances).toHaveLength(1);
	});

	it('cancels a pending reconnect when the connection is closed explicitly', () => {
		vi.useFakeTimers();
		const connection = createWebSocket(onMessage);
		FakeWebSocket.instances[0].dispatch('close');
		expect(vi.getTimerCount()).toBe(1);

		connection.close();
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(60_000);
		expect(FakeWebSocket.instances).toHaveLength(1);
	});

	it('retries when the WebSocket constructor throws', () => {
		vi.useFakeTimers();
		const onStatusChange = vi.fn();
		let attempts = 0;
		class FlakyWebSocket extends FakeWebSocket {
			constructor(url: string) {
				attempts += 1;
				if (attempts === 1) throw new Error('blocked');
				super(url);
			}
		}
		vi.stubGlobal('WebSocket', FlakyWebSocket);

		createWebSocket(onMessage, onStatusChange);
		expect(FakeWebSocket.instances).toHaveLength(0);
		expect(onStatusChange).toHaveBeenLastCalledWith('disconnected');

		vi.advanceTimersByTime(1_000);
		expect(FakeWebSocket.instances).toHaveLength(1);
	});

	it('does not duplicate the disconnected status on a reentrant close after a constructor throw', () => {
		vi.useFakeTimers();
		let connection: WebSocketConnection;
		let disconnectedCount = 0;
		const onStatusChange = (status: ConnectionStatus) => {
			if (status !== 'disconnected') return;
			disconnectedCount += 1;
			if (disconnectedCount === 2) connection?.close();
		};
		let attempts = 0;
		class FailsOnReconnect extends FakeWebSocket {
			constructor(url: string) {
				attempts += 1;
				if (attempts === 2) throw new Error('blocked');
				super(url);
			}
		}
		vi.stubGlobal('WebSocket', FailsOnReconnect);

		connection = createWebSocket(onMessage, onStatusChange);
		FakeWebSocket.instances[0].dispatch('close');
		vi.advanceTimersByTime(1_000);

		expect(disconnectedCount).toBe(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('notifies of closure only once when closed repeatedly', () => {
		vi.useFakeTimers();
		const onStatusChange = vi.fn();
		const connection = createWebSocket(onMessage, onStatusChange);
		connection.close();
		connection.close();

		expect(onStatusChange).toHaveBeenCalledTimes(2); // connecting, then disconnected
		expect(onStatusChange).toHaveBeenLastCalledWith('disconnected');
	});

	it('does not emit a duplicate disconnected status for a reentrant close', () => {
		vi.useFakeTimers();
		let connection: WebSocketConnection;
		const onStatusChange = vi.fn((status: ConnectionStatus) => {
			if (status === 'disconnected') connection.close();
		});
		connection = createWebSocket(onMessage, onStatusChange);

		FakeWebSocket.instances[0].dispatch('close');
		expect(onStatusChange.mock.calls.filter(([status]) => status === 'disconnected')).toHaveLength(1);
	});

	it('does not open a replacement socket when teardown happens during a status callback', () => {
		vi.useFakeTimers();
		let connection: WebSocketConnection | undefined;
		const onStatusChange = (status: ConnectionStatus) => {
			if (status === 'connecting') connection?.close();
		};

		connection = createWebSocket(onMessage, onStatusChange);
		FakeWebSocket.instances[0].dispatch('close');
		vi.advanceTimersByTime(1_000);

		expect(FakeWebSocket.instances).toHaveLength(1);
		expect(vi.getTimerCount()).toBe(0);
	});
});