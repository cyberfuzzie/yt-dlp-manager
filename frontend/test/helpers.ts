import type { DownloadInfo } from '#lib/types.ts';

/** Factory for a fully-populated DownloadInfo that tests can override. */
export function makeDownload(overrides: Partial<DownloadInfo> = {}): DownloadInfo {
	return {
		id: 'id-1',
		url: 'https://example.com/watch',
		targetDirectory: null,
		format: null,
		quality: null,
		status: 'PENDING',
		progress: 0,
		speed: null,
		eta: null,
		filename: null,
		fileSize: null,
		errorMessage: null,
		createdAt: '2026-01-01T12:00:00Z',
		startedAt: null,
		completedAt: null,
		...overrides,
	};
}