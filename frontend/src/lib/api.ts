import type { DownloadInfo, DownloadRequest, DownloadResponse, ConfigResponse, WebSocketMessage } from './types';

const API_BASE = '/api';
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface WebSocketConnection {
    close(): void;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
}

export const api = {
    getConfig: (): Promise<ConfigResponse> => 
        fetchJson(`${API_BASE}/config`),
    
    getDownloads: (): Promise<DownloadInfo[]> => 
        fetchJson(`${API_BASE}/downloads`),
    
    getDownload: (id: string): Promise<DownloadInfo> => 
        fetchJson(`${API_BASE}/downloads/${id}`),
    
    addDownload: (request: DownloadRequest): Promise<DownloadResponse> => 
        fetchJson(`${API_BASE}/downloads`, {
            method: 'POST',
            body: JSON.stringify(request),
        }),
    
    cancelDownload: (id: string): Promise<{ message: string }> => 
        fetchJson(`${API_BASE}/downloads/${id}`, {
            method: 'DELETE',
        }),
};

/**
 * Opens a WebSocket that reconnects automatically after unexpected closures.
 *
 * Listeners are registered with addEventListener so callers can safely attach
 * their own on* handlers without disabling reconnection. Call close() when the
 * connection is no longer needed (for example on component teardown) to stop
 * the reconnect loop.
 */
export function createWebSocket(
    onMessage: (data: DownloadInfo) => void,
    onStatusChange?: (status: ConnectionStatus) => void,
): WebSocketConnection {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let intentionallyClosed = false;
    let closeNotified = false;

    function notifyClosed(): void {
        if (closeNotified) return;
        closeNotified = true;
        onStatusChange?.('disconnected');
    }

    function scheduleReconnect(): void {
        if (intentionallyClosed || reconnectTimer !== null) return;

        const delay = Math.min(
            RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
            RECONNECT_MAX_DELAY_MS,
        );
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, delay);
    }

    function connect(): void {
        closeNotified = false;
        onStatusChange?.('connecting');
        // Teardown may have been requested from the status callback above.
        if (intentionallyClosed) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let current: WebSocket;
        try {
            current = new WebSocket(`${protocol}//${window.location.host}${API_BASE}/ws`);
        } catch {
            // A blocked or invalid socket can throw synchronously; retry like any other failure.
            notifyClosed();
            scheduleReconnect();
            return;
        }

        socket = current;

        current.addEventListener('message', (event: MessageEvent<string>) => {
            if (current !== socket) return;
            try {
                const message: WebSocketMessage = JSON.parse(event.data);
                if (message.type === 'download_update') {
                    onMessage(message.payload);
                }
            } catch {
                // Silently ignore malformed messages — the WebSocket connection stays alive.
            }
        });

        current.addEventListener('open', () => {
            if (current !== socket) return;
            reconnectAttempt = 0;
            onStatusChange?.('connected');
        });

        current.addEventListener('error', () => {
            if (current !== socket) return;
            notifyClosed();
        });

        current.addEventListener('close', () => {
            if (current !== socket) return;
            notifyClosed();
            socket = null;
            scheduleReconnect();
        });
    }

    connect();

    return {
        close(): void {
            if (intentionallyClosed) return;
            intentionallyClosed = true;
            if (reconnectTimer !== null) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            const current = socket;
            socket = null;
            current?.close();
            notifyClosed();
        },
    };
}
