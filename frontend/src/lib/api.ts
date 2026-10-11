import type { DownloadInfo, DownloadRequest, DownloadResponse, ConfigResponse, WebSocketMessage } from './types';

const API_BASE = '/api';

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

export function createWebSocket(onMessage: (data: DownloadInfo) => void): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}${API_BASE}/ws`);
    
    ws.onmessage = (event) => {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);
            if (message.type === 'download_update') {
                onMessage(message.payload);
            }
        } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket connection closed');
        // Reconnect after 3 seconds
        setTimeout(() => {
            createWebSocket(onMessage);
        }, 3000);
    };
    
    return ws;
}