import { addMessages, init, t, locale } from 'svelte-i18n';
import { get } from 'svelte/store';
import en from '../locales/en.json';
import de from '../locales/de.json';

// Re-export svelte-i18n's locale store directly — single source of truth.
export { locale };

// Pre-register message dictionaries for all supported locales.
addMessages('en', en);
addMessages('de', de);

// Initialize svelte-i18n eagerly so t() and $getT work before onMount.
await init({ fallbackLocale: 'en', initialLocale: 'en' });

/** Detect locale from localStorage or browser, falling back to English. */
function detectLocale(persisted: string | null): string {
    if (persisted && (persisted === 'de' || persisted === 'en')) return persisted;
    if (typeof navigator !== 'undefined' && navigator.language?.startsWith('de')) return 'de';
    return 'en';
}

/**
 * Set the current locale and persist the choice to localStorage.
 * Accepts any string but only 'de' and 'en' are valid locales.
 *
 * **Normalisation:** Any value that is not exactly `'de'` maps to `'en'`
 * (including `'DE'`, `'de-DE'`, `'english'`, etc.). This makes the API
 * robust against user input but it **does not emit a warning** for invalid
 * values. Callers should pass only `'de'` or `'en'` — use `detectLocale()`
 * if the source value may contain subtags or mixed case.
 */
export function setLocale(value: string): void {
    const targetLocale = value === 'de' ? 'de' : 'en';
    locale.set(targetLocale);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('yt-dlp-lang', targetLocale);
    }
}

/** Get the current locale synchronously (no subscription). */
export function getLocale(): string {
    return get(locale) ?? 'en';
}

/**
 * Normalised translation function – reads the latest t value on each call
 * so that locale changes are always respected.
 *
 * Accepts raw values `{ n: 5 }` (standard component usage) or already-wrapped
 * svelte-i18n format `{ values: { n: 5 } }` (when called by `formatRelativeTime`).
 */
export const unwrapT: (id: string, values?: Record<string, unknown>) => string =
    (id, values) => {
        let fn: Function | undefined;
        t.subscribe((f) => (fn = f))();
        // Detect whether values is already in svelte-i18n format { values: {...} }
        // or raw { key: value }. svelte-i18n's t() expects { values: {...} }.
        const args = values && 'values' in values
            ? values          // already wrapped – pass through
            : { values };     // raw – wrap for svelte-i18n
        return fn!(id, args as any) as string;
    };

/** Available locales for the language switcher dropdown. */
export const availableLocales = ['de', 'en'] as const;

/** Sync locale from localStorage and set document language attributes. */
export function initLocale(): void {
    const persisted = typeof localStorage !== 'undefined' ? localStorage.getItem('yt-dlp-lang') : null;
    const detectedLocale = detectLocale(persisted);
    const currentLocale = get(locale);
    if (detectedLocale !== currentLocale) {
        locale.set(detectedLocale);
    }
    document.documentElement.lang = detectedLocale;
    document.documentElement.dataset.lang = detectedLocale;
}
