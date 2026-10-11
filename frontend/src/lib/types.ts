export interface DownloadRequest {
    url: string;
    targetDirectory?: string;
    format?: string;
    quality?: string;
}

export type DownloadStatus = 'PENDING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface DownloadInfo {
    id: string;
    url: string;
    targetDirectory: string | null;
    format: string | null;
    quality: string | null;
    status: DownloadStatus;
    progress: number;
    speed: string | null;
    eta: string | null;
    filename: string | null;
    fileSize: number | null;
    errorMessage: string | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
}

export interface DownloadResponse {
    id: string;
    message: string;
}

export interface ConfigResponse {
    baseDirectory: string;
}

export interface WebSocketMessage {
    type: string;
    payload: DownloadInfo;
}

export const STATUS_LABELS: Record<DownloadStatus, string> = {
    PENDING: 'Wartend',
    DOWNLOADING: 'Wird heruntergeladen',
    COMPLETED: 'Abgeschlossen',
    FAILED: 'Fehlgeschlagen',
    CANCELLED: 'Abgebrochen',
};

export const STATUS_COLORS: Record<DownloadStatus, string> = {
    PENDING: '#fbbf24',
    DOWNLOADING: '#3b82f6',
    COMPLETED: '#22c55e',
    FAILED: '#ef4444',
    CANCELLED: '#6b7280',
};