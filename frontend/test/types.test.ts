import { describe, expect, it } from 'vitest';
import * as components from '#lib/components/index.ts';
import { STATUS_KEYS, STATUS_COLORS, STATUS_LABELS } from '#lib/types.ts';
import type { DownloadStatus } from '#lib/types.ts';

const statuses: DownloadStatus[] = ['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'];

describe('status maps', () => {
	it('map every status to a label and a colour', () => {
		for (const status of statuses) {
			expect(STATUS_LABELS[status]).toBeTruthy();
			expect(STATUS_COLORS[status]).toMatch(/^#/);
		}
	});

	it('cover exactly the known statuses', () => {
		expect(STATUS_KEYS).toEqual([...statuses]);
		expect(Object.keys(STATUS_LABELS).sort()).toEqual([...statuses].sort());
		expect(Object.keys(STATUS_COLORS).sort()).toEqual([...statuses].sort());
	});
});

describe('component barrel', () => {
	it('re-exports every component', () => {
		expect(components.DownloadForm).toBeDefined();
		expect(components.DownloadList).toBeDefined();
		expect(components.DownloadItem).toBeDefined();
		expect(components.StatusBadge).toBeDefined();
		expect(components.LanguageSwitcher).toBeDefined();
	});
});
