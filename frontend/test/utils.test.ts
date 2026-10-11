import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractDomain, formatBytes, formatDate, formatRelativeTime, truncate } from '#lib/utils.ts';

describe('formatDate', () => {
	it('formats an ISO string for the de-DE locale', () => {
		expect(formatDate('2026-01-01T00:00:00Z')).toBe('01.01.2026, 00:00');
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

	it('renders "gerade eben" for the last minute', () => {
		expect(formatRelativeTime(ago(30_000))).toBe('gerade eben');
	});

	it('renders minutes', () => {
		expect(formatRelativeTime(ago(5 * 60_000))).toBe('vor 5 Min.');
	});

	it('renders hours', () => {
		expect(formatRelativeTime(ago(3 * 60 * 60_000))).toBe('vor 3 Std.');
	});

	it('renders a single day in the singular', () => {
		expect(formatRelativeTime(ago(24 * 60 * 60_000))).toBe('vor 1 Tag');
	});

	it('renders several days in the plural', () => {
		expect(formatRelativeTime(ago(3 * 24 * 60 * 60_000))).toBe('vor 3 Tagen');
	});

	it('falls back to an absolute date after a week', () => {
		expect(formatRelativeTime(ago(10 * 24 * 60 * 60_000))).toBe('22.12.2025, 12:00');
	});
});

describe('formatBytes', () => {
	it('handles missing values', () => {
		expect(formatBytes(null)).toBe('Unbekannt');
		expect(formatBytes(undefined as unknown as null)).toBe('Unbekannt');
	});

	it('handles zero', () => {
		expect(formatBytes(0)).toBe('0 B');
	});

	it('formats each unit', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(1024 * 1024)).toBe('1 MB');
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
		expect(formatBytes(1024 ** 4)).toBe('1 TB');
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
