import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import { getLocale, setLocale, subscribe, t, locale, availableLocales, unwrapT } from '#lib/i18n.ts';

describe('locale store', () => {
	beforeEach(() => setLocale('de'));

	it('is a writable store initialised with the current locale', () => {
		const received: string[] = [];
		const unsubscribe = locale.subscribe((l) => { received.push(l); });
		unsubscribe();
		expect(received).toContain('de');
	});

	it('getLocale returns a valid locale', () => {
		const loc = getLocale();
		expect(['de', 'en']).toContain(loc);
	});

	it('setLocale updates the store and persists to localStorage', () => {
		const received: string[] = [];
		const unsubscribe = locale.subscribe((l) => { received.push(l); });
		const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
		setItemSpy.mockImplementation(() => {});
		setLocale('en');
		unsubscribe();
		expect(received).toContain('en');
		expect(setItemSpy).toHaveBeenCalledWith('yt-dlp-lang', 'en');
		setLocale('de');
	});

	it('normalises invalid values without throwing', () => {
		setLocale('fr');
		expect(getLocale()).toBe('en');
		setLocale('DE');
		expect(getLocale()).toBe('en');
		setLocale('de');
	});
});

describe('translations completeness', () => {
	beforeEach(() => setLocale('de'));

	it('has German and English locales available', () => {
		expect(availableLocales).toEqual(['de', 'en']);
	});

	it('returns correct status labels for German (via unwrapT)', async () => {
		setLocale('de');
		expect(unwrapT('status.pending')).toBe('Wartend');
		expect(unwrapT('status.downloading')).toBe('Läuft');
		expect(unwrapT('status.completed')).toBe('Abgeschlossen');
		expect(unwrapT('status.failed')).toBe('Fehlgeschlagen');
		expect(unwrapT('status.cancelled')).toBe('Abgebrochen');
	});

	it('returns correct status labels for English', async () => {
		setLocale('en');
		expect(unwrapT('status.pending')).toBe('Pending');
		expect(unwrapT('status.downloading')).toBe('Downloading');
		expect(unwrapT('status.completed')).toBe('Completed');
		expect(unwrapT('status.failed')).toBe('Failed');
		expect(unwrapT('status.cancelled')).toBe('Cancelled');
		setLocale('de');
	});
});

describe('initLocale', () => {
	afterEach(() => {
		setLocale('de');
		vi.restoreAllMocks();
	});

	it('uses persisted locale from localStorage', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) =>
			key === 'yt-dlp-lang' ? 'en' : null
		);

		const { initLocale } = await import('#lib/i18n.ts');
		await initLocale();

		expect(getLocale()).toBe('en');
	});

	it('detects browser language when no localStorage entry', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
		vi.spyOn(Object.getPrototypeOf(navigator), 'language', 'get').mockReturnValue('de-DE');

		const { initLocale } = await import('#lib/i18n.ts');
		await initLocale();

		expect(getLocale()).toBe('de');
	});

	it('falls back to English for unknown browser language', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
		vi.spyOn(Object.getPrototypeOf(navigator), 'language', 'get').mockReturnValue('fr-FR');

		const { initLocale } = await import('#lib/i18n.ts');
		await initLocale();

		expect(getLocale()).toBe('en');
	});
});
