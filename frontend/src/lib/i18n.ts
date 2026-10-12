import { addMessages, init, t, locale as nativeLocale } from 'svelte-i18n';
import { writable } from 'svelte/store';
import en from '../locales/en.json';
import de from '../locales/de.json';

export { t };

// Pre-register message dictionaries for all supported locales.
addMessages('en', en);
addMessages('de', de);

// Initialize svelte-i18n eagerly so createT() works before onMount.
await init({ fallbackLocale: 'en', initialLocale: 'en' });

/** Writable locale store – use Svelte's $ auto-subscription for reactivity. */
export const locale = writable<string>('en');

/** Detect locale from localStorage or browser, falling back to English. */
function detectLocale(persisted: string | null): string {
    if (persisted && (persisted === 'de' || persisted === 'en')) return persisted;
    if (typeof navigator !== 'undefined' && navigator.language?.startsWith('de')) return 'de';
    return 'en';
}

/**
 * Set the current locale and persist the choice to localStorage.
 * Accepts any string but only 'de' and 'en' are valid locales.
 */
export function setLocale(value: string): void {
    const targetLocale = value === 'de' ? 'de' : 'en';
    nativeLocale.set(targetLocale);
    locale.set(targetLocale);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('yt-dlp-lang', targetLocale);
    }
}

/** Get the current locale synchronously (no subscription). */
export function getLocale(): string {
    let current = 'en';
    const unsub = nativeLocale.subscribe((v) => { current = v ?? 'en'; });
    unsub();
    return current;
}

/**
 * Normalised translation function – reads the latest t value on each call
 * so that locale changes are always respected.
 */
export const unwrapT: (id: string, values?: Record<string, unknown>) => string =
    (id, values) => {
        let fn: Function | undefined;
        t.subscribe((f) => (fn = f))();
        return fn!(id, { values } as any) as string;
    };

/**
 * Factory – call once per component to get a normalised t function.
 * The returned function reads the latest t value on each invocation.
 */
export function createT() {
    return (id: string, values?: Record<string, unknown>): string => {
        let fn: Function | undefined;
        t.subscribe((f) => (fn = f))();
        return fn!(id, { values } as any) as string;
    };
}

/** Available locales for the language switcher dropdown. */
export const availableLocales = ['de', 'en'] as const;
export type Locale = typeof availableLocales[number];

/** Subscribe to the current locale. */
export function subscribe(run: (value: string) => void): () => void {
    return locale.subscribe(run);
}

/** Sync locale from localStorage and set document language attributes. */
export function initLocale(): void {
    const persisted = typeof localStorage !== 'undefined' ? localStorage.getItem('yt-dlp-lang') : null;
    const detectedLocale = detectLocale(persisted);
    const currentLocale = (() => {
        let v = 'en';
        let unsub: (() => void) | undefined;
        unsub = locale.subscribe(val => { v = val; unsub?.(); });
        return v;
    })();
    if (detectedLocale !== currentLocale) {
        nativeLocale.set(detectedLocale);
        locale.set(detectedLocale);
    }
    document.documentElement.lang = detectedLocale;
    document.documentElement.dataset.lang = detectedLocale;
}
