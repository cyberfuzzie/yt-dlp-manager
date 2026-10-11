import { writable } from 'svelte/store';
import { translations, defaultLocale, availableLocales, type Locale } from './i18n/translations.ts';

/** Current locale – use with Svelte's $ auto-subscription in components. */
export const locale = writable<Locale>(defaultLocale);

/** Available locales for the language switcher dropdown. */
export { availableLocales };
export type { Locale };

/** Subscribe to the current locale. */
export function subscribe(run: (value: Locale) => void): () => void {
    return locale.subscribe(run);
}

/** Get the current locale synchronously (no subscription). */
export function getLocale(): Locale {
    let value: Locale = defaultLocale;
    locale.subscribe((v) => { value = v; })();
    return value;
}

/**
 * Translation helper – reads the locale from the writable store internally.
 * Use inside reactive statements together with Svelte's $locale auto-subscription.
 */
export function t(key: string, ...args: unknown[]): string {
    const dict = translations[getLocale()];
    let raw = dict[key];
    if (raw === undefined) return key;
    if (typeof raw === 'function') raw = raw(...args);
    return raw;
}

/** Set the locale and persist the choice in localStorage. */
export function setLocale(value: Locale): void {
    locale.set(value);
    try {
        localStorage.setItem('yt-dlp-lang', value);
    } catch {
        // localStorage may be unavailable
    }
    updateHtmlLang(value);
}

/** Read the persisted locale from localStorage, falling back to the default. */
function readPersistedLocale(): Locale | null {
    try {
        const saved = localStorage.getItem('yt-dlp-lang');
        if (saved === 'de' || saved === 'en') return saved;
    } catch {
        // ignore
    }
    return null;
}

/** Detect the user's preferred locale from the browser. */
function detectBrowserLocale(): Locale {
    try {
        if (typeof navigator !== 'undefined') {
            const browserLang = navigator.language.toLowerCase();
            if (browserLang.startsWith('de')) return 'de';
            if (browserLang.startsWith('en')) return 'en';
        }
    } catch {
        // navigator may not be available (SSR)
    }
    return defaultLocale;
}

/** Update the <html> lang attribute to match the given locale. */
function updateHtmlLang(value: Locale): void {
    try {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = value;
            document.documentElement.dataset.lang = value;
        }
    } catch {
        // document may not be available (SSR)
    }
}

/**
 * Initialize the locale store from localStorage or browser detection.
 * Call this early (e.g. in onMount of the root layout) so the store
 * has the right value before first render.
 */
export function initLocale(): void {
    // 1. Check persisted user choice first
    const persisted = readPersistedLocale();
    if (persisted) {
        locale.set(persisted);
        updateHtmlLang(persisted);
        return;
    }

    // 2. Detect from browser language
    const detected = detectBrowserLocale();
    locale.set(detected);
    updateHtmlLang(detected);
}
