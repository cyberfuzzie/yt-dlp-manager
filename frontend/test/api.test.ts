import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, createWebSocket } from '#lib/api.ts';
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

class FakeWebSocket {
	static instances: FakeWebSocket[] = [];
	onmessage: ((event: { data: string }) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onclose: ((event: unknown) => void) | null = null;
	close = vi.fn();

	constructor(public url: string) {
		FakeWebSocket.instances.push(this);
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
		ws.onmessage?.({ data: JSON.stringify({ type: 'download_update', payload: download }) });
		expect(onMessage).toHaveBeenCalledWith(download);
	});

	it('ignores message types that are not download updates', () => {
		createWebSocket(onMessage);
		FakeWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ type: 'other', payload: {} }) });
		expect(onMessage).not.toHaveBeenCalled();
	});

	it('silently ignores malformed messages', () => {
		createWebSocket(onMessage);
		FakeWebSocket.instances[0].onmessage?.({ data: 'not json' });
		expect(onMessage).not.toHaveBeenCalled();
	});

	it('silently handles WebSocket errors', () => {
		createWebSocket(onMessage);
		FakeWebSocket.instances[0].onerror?.({});
		// No throw — the error handler is a no-op; onclose will trigger reconnection.
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

	it('reconnects after the socket closes', () => {
		vi.useFakeTimers();
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		createWebSocket(onMessage);
		FakeWebSocket.instances[0].onclose?.({});
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(3000);
		expect(FakeWebSocket.instances).toHaveLength(2);
		logSpy.mockRestore();
	});
});