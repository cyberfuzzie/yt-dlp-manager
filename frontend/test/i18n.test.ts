import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import { getLocale, setLocale, subscribe, t, type Locale } from '#lib/i18n.ts';
import { availableLocales, defaultLocale, getStatusLabels, localeNames, translations } from '#lib/i18n/translations.ts';

describe('locale store', () => {
	beforeEach(() => setLocale('de'));

	it('defaults to English', () => {
		expect(defaultLocale).toBe('en');
	});

	it('recognizes available locales', () => {
		expect(availableLocales).toEqual(['de', 'en']);
	});

	it('getLocale returns a valid locale', () => {
		const locale = getLocale();
		expect(availableLocales).toContain(locale);
	});

	it('setLocale updates the store', () => {
		const received: Locale[] = [];
		const unsubscribe = subscribe((locale) => { received.push(locale); });
		setLocale('en');
		unsubscribe();
		expect(received).toContain('en');
		setLocale('de');
	});

	it('setLocale rejects invalid values without throwing', () => {
		// @ts-expect-error invalid type
		expect(() => setLocale('fr')).not.toThrow();
	});
});

describe('localeNames', () => {
	beforeEach(() => setLocale('de'));

	it('shows languages in their native names', () => {
		expect(localeNames.de).toBe('Deutsch');
		expect(localeNames.en).toBe('English');
	});

	it('is locale-independent (always native names)', () => {
		setLocale('en');
		expect(localeNames.de).toBe('Deutsch');
		expect(localeNames.en).toBe('English');
	});
});

describe('t()', () => {
	beforeEach(() => setLocale('de'));

	it('returns German strings by default', () => {
		expect(t('app.title')).toBe('yt-dlp Manager');
		expect(t('connection.connected')).toBe('Verbunden');
		expect(t('form.submit')).toBe('Downloads starten');
	});

	it('returns English strings when locale is English', () => {
		setLocale('en');
		expect(t('app.title')).toBe('yt-dlp Manager');
		expect(t('connection.connected')).toBe('Connected');
		expect(t('form.submit')).toBe('Start Downloads');
		setLocale('de');
	});

	it('returns parameterized strings correctly (German)', () => {
		expect(t('form.urls.urlCount', 1)).toBe('1 URL erkannt');
		expect(t('form.urls.urlCount', 5)).toBe('5 URLs erkannt');
	});

	it('returns parameterized strings correctly (English)', () => {
		setLocale('en');
		expect(t('form.urls.urlCount', 1)).toBe('1 URL detected');
		expect(t('form.urls.urlCount', 5)).toBe('5 URLs detected');
		setLocale('de');
	});

	it('falls back to the key for unknown keys', () => {
		const key = '__nonexistent_key_xyz__';
		expect(t(key)).toBe(key);
	});

	it('translates utils relative time strings (German)', () => {
		expect(t('utils.now')).toBe('gerade eben');
		expect(t('utils.minutesAgo', 5)).toBe('vor 5 Min.');
		expect(t('utils.hoursAgo', 3)).toBe('vor 3 Std.');
		expect(t('utils.daysAgo', 1)).toBe('vor 1 Tag');
		expect(t('utils.daysAgo', 3)).toBe('vor 3 Tagen');
	});

	it('translates utils relative time strings (English)', () => {
		setLocale('en');
		expect(t('utils.now')).toBe('just now');
		expect(t('utils.minutesAgo', 5)).toBe('5 min ago');
		expect(t('utils.hoursAgo', 3)).toBe('3 hr ago');
		expect(t('utils.daysAgo', 1)).toBe('1 day ago');
		expect(t('utils.daysAgo', 3)).toBe('3 days ago');
		setLocale('de');
	});

	it('translates error messages', () => {
		expect(t('error.add')).toBe('Fehler beim Hinzufügen');
		expect(t('error.cancel')).toBe('Fehler beim Abbrechen');
		expect(t('error.unknown')).toBe('Unbekannter Fehler');

		setLocale('en');
		expect(t('error.add')).toBe('Error adding');
		expect(t('error.cancel')).toBe('Error cancelling');
		expect(t('error.unknown')).toBe('Unknown error');
		setLocale('de');
	});

	it('translates form urls.invalid (German)', () => {
		expect(t('form.urls.invalid', 'not a url')).toBe('Ungültige URL: not a url');
	});

	it('translates form urls.invalid (English)', () => {
		setLocale('en');
		expect(t('form.urls.invalid', 'not a url')).toBe('Invalid URL: not a url');
		setLocale('de');
	});

	it('translates item details toggle (German)', () => {
		expect(t('item.detailsToggle', false)).toBe('Details anzeigen');
		expect(t('item.detailsToggle', true)).toBe('Details ausblenden');
	});

	it('translates item details toggle (English)', () => {
		setLocale('en');
		expect(t('item.detailsToggle', false)).toBe('Show details');
		expect(t('item.detailsToggle', true)).toBe('Hide details');
		setLocale('de');
	});
});

describe('translations completeness', () => {
	beforeEach(() => setLocale('de'));

	it('has translations for all supported locales', () => {
		for (const locale of availableLocales) {
			expect(translations[locale]).toBeDefined();
		}
	});

	it('has German and English keys for all translation keys', () => {
		const deKeys = Object.keys(translations.de);
		const enKeys = Object.keys(translations.en);
		expect(deKeys.sort()).toEqual(enKeys.sort());
	});

	it('returns correct status labels for German', () => {
		const labels = getStatusLabels('de');
		expect(labels.PENDING).toBe('Wartend');
		expect(labels.DOWNLOADING).toBe('Wird heruntergeladen');
		expect(labels.COMPLETED).toBe('Abgeschlossen');
		expect(labels.FAILED).toBe('Fehlgeschlagen');
		expect(labels.CANCELLED).toBe('Abgebrochen');
	});

	it('returns correct status labels for English', () => {
		const labels = getStatusLabels('en');
		expect(labels.PENDING).toBe('Pending');
		expect(labels.DOWNLOADING).toBe('Downloading');
		expect(labels.COMPLETED).toBe('Completed');
		expect(labels.FAILED).toBe('Failed');
		expect(labels.CANCELLED).toBe('Cancelled');
	});
});

describe('initLocale', () => {
	afterEach(() => {
		setLocale('de');
		vi.restoreAllMocks();
	});

	it('uses persisted locale from localStorage', async () => {
		const mock = vi.fn((key: string) => (key === 'yt-dlp-lang' ? 'en' : null));
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(mock);

		const { initLocale } = await import('#lib/i18n.ts');
		initLocale();

		expect(mock).toHaveBeenCalledWith('yt-dlp-lang');
		expect(getLocale()).toBe('en');
	});

	it('detects browser language when no localStorage entry', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

		const { initLocale } = await import('#lib/i18n.ts');
		initLocale();

		expect(getLocale()).toBe('en');
	});

	it('falls back to English for unknown browser language', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
		vi.spyOn(Object.getPrototypeOf(navigator), 'language', 'get').mockReturnValue('fr-FR');

		const { initLocale } = await import('#lib/i18n.ts');
		initLocale();

		expect(getLocale()).toBe('en');
	});
});
