<script lang="ts">
    import { setLocale, availableLocales } from '#lib/i18n.ts';
    import { locale as i18nLocale } from 'svelte-i18n';

    const localeNames: Record<string, string> = {
        de: 'Deutsch',
        en: 'English',
    };

    function handleChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        setLocale(select.value);
    }
</script>

<select
    on:change={handleChange}
    class="lang-switcher"
    aria-label="Language"
>
    {#each availableLocales as loc (loc)}
        <option value={loc} selected={$i18nLocale === loc}>{localeNames[loc]}</option>
    {/each}
</select>

<style>
    .lang-switcher {
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.2s;
    }

    .lang-switcher:hover {
        border-color: var(--accent);
    }

    .lang-switcher:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);
    }
</style>
