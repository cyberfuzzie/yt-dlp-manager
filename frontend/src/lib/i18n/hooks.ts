// Re-exports for convenience.
// Components should import `{ locale as $locale, t }` directly from '#lib/i18n.ts'
// and use `$locale` inside reactive statements for reactivity:
//   $: msg = t('key');   // reacts to $locale changes
export { locale as $locale } from '#lib/i18n.ts';
export { t } from '#lib/i18n.ts';
export { getLocale } from '#lib/i18n.ts';
export { setLocale } from '#lib/i18n.ts';
export { availableLocales } from '#lib/i18n.ts';
