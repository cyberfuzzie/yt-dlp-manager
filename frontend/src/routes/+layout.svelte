<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { initLocale } from '#lib/i18n.ts';
    import { locale as i18nLocale } from 'svelte-i18n';

    onMount(() => {
        initLocale();
        // i18nLocale is svelte-i18n's locale store.
        const lang = $i18nLocale ?? 'en';
        document.documentElement.lang = lang;
        document.documentElement.dataset.lang = lang;
        return i18nLocale.subscribe((l) => {
            const current = l ?? 'en';
            document.documentElement.lang = current;
            document.documentElement.dataset.lang = current;
        });
    });
</script>

<div id="app">
    <slot />
</div>
