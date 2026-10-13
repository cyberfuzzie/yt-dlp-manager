import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { extractDomain, formatBytes, formatDate, formatRelativeTime, truncate } from '#lib/utils.ts';
import { setLocale, unwrapT } from '#lib/i18n.ts';

describe('formatDate', () => {
	it('formats an ISO string for the de-DE locale (default)', () => {
		setLocale('de');
		expect(formatDate('2026-01-01T00:00:00Z')).toBe('01.01.2026, 00:00');
	});

	it('formats an ISO string for en-US locale', () => {
		setLocale('en');
		expect(formatDate('2026-01-01T00:00:00Z')).toBe('01/01/2026, 12:00 AM');
		setLocale('de');
	});
});

describe('formatRelativeTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

	describe('German locale', () => {
		beforeEach(() => setLocale('de'));

		it('renders "gerade eben" for the last minute', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(30_000), t)).toBe('gerade eben');
		});

		it('renders minutes', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(5 * 60_000), t)).toBe('vor 5 Min.');
		});

		it('renders hours', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(3 * 60 * 60_000), t)).toBe('vor 3 Std.');
		});

		it('renders a single day in the singular', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(24 * 60 * 60_000), t)).toBe('vor 1 Tag');
		});

		it('renders several days in the plural', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(3 * 24 * 60 * 60_000), t)).toBe('vor 3 Tagen');
		});

		it('falls back to an absolute date after a week', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(10 * 24 * 60 * 60_000), t)).toBe('22.12.2025, 12:00');
		});
	});

	describe('English locale', () => {
		beforeEach(() => setLocale('en'));

		it('renders "just now" for the last minute', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(30_000), t)).toBe('just now');
		});

		it('renders minutes', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(5 * 60_000), t)).toBe('5 min ago');
		});

		it('renders hours', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(3 * 60 * 60_000), t)).toBe('3 hr ago');
		});

		it('renders a single day in the singular', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(24 * 60 * 60_000), t)).toBe('1 day ago');
		});

		it('renders several days in the plural', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(3 * 24 * 60 * 60_000), t)).toBe('3 days ago');
		});

		it('falls back to an absolute date after a week', () => {
			const t = unwrapT;
			expect(formatRelativeTime(ago(10 * 24 * 60 * 60_000), t)).toBe('12/22/2025, 12:00 PM');
		});

		afterEach(() => setLocale('de'));
	});
});

describe('formatBytes', () => {
	beforeEach(() => setLocale('de'));

	it('handles missing values (German)', () => {
		expect(formatBytes(null)).toBe('Unbekannt');
		expect(formatBytes(undefined as unknown as null)).toBe('Unbekannt');
	});

	it('handles zero', () => {
		expect(formatBytes(0)).toBe('0 B');
	});

	it('formats each unit', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(1536)).toBe('1,5 KB');
		expect(formatBytes(1024 * 1024)).toBe('1 MB');
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
		expect(formatBytes(1024 ** 4)).toBe('1 TB');
	});

	it('handles missing values (English)', () => {
		setLocale('en');
		expect(formatBytes(null)).toBe('Unknown');
		expect(formatBytes(1536)).toBe('1.5 KB');
		setLocale('de');
	});
});

describe('truncate', () => {
	it('leaves short strings untouched', () => {
		expect(truncate('short', 10)).toBe('short');
	});

	it('truncates long strings', () => {
		expect(truncate('abcdefghij', 5)).toBe('ab...');
	});
});

describe('extractDomain', () => {
	it('strips the www prefix', () => {
		expect(extractDomain('https://www.youtube.com/watch?v=abc')).toBe('youtube.com');
	});

	it('keeps other hosts as-is', () => {
		expect(extractDomain('https://twitch.tv/some/channel')).toBe('twitch.tv');
	});

	it('returns the input when it cannot be parsed as a URL', () => {
		expect(extractDomain('not a url')).toBe('not a url');
	});
});
