<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { initLocale } from '#lib/i18n.ts';

    onMount(() => {
        initLocale();
    });
</script>

<div id="app">
    <slot />
</div>