<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { initLocale, locale } from '#lib/i18n.ts';

    onMount(() => {
        initLocale();
        document.documentElement.lang = $locale;
        document.documentElement.dataset.lang = $locale;
        return locale.subscribe((l) => {
            document.documentElement.lang = l;
            document.documentElement.dataset.lang = l;
        });
    });
</script>

<div id="app">
    <slot />
</div>