import { describe, expect, it } from 'vitest';
import * as components from '#lib/components/index.ts';
import { STATUS_KEYS, STATUS_COLORS } from '#lib/types.ts';
import type { DownloadStatus } from '#lib/types.ts';

const statuses: DownloadStatus[] = ['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'];

describe('status maps', () => {
	it('maps every status to a colour', () => {
		for (const status of statuses) {
			expect(STATUS_COLORS[status]).toMatch(/^#/);
		}
	});

	it('covers exactly the known statuses', () => {
		expect(STATUS_KEYS).toEqual([...statuses]);
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
