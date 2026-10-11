<script lang="ts">
    import type { DownloadRequest } from '#lib/types.ts';
    import { onMount } from 'svelte';
    import { t } from '#lib/i18n.ts';
    
    export let onSubmit: (requests: DownloadRequest[]) => void;
    export let isLoading = false;
    export let baseDirectory = '';
    
    let urls = '';
    let targetDirectory = '';
    let format = '';
    let quality = '';
    let showAdvanced = false;
    let urlErrors: string[] = [];
    
    $: formTitle = t('form.title');
    $: urlsLabel = t('form.urls.label');
    $: urlsPlaceholder = t('form.urls.placeholder');
    $: directoryLabel = t('form.directory.label');
    $: directoryPlaceholder = t('form.directory.placeholder');
    $: directoryHint = t('form.directory.hint');
    $: advancedText = showAdvanced ? t('form.advancedLess') : t('form.advanced');
    $: submitText = isLoading ? t('form.submitting') : t('form.submit');
    $: formatLabel = t('form.format.label');
    $: formatPlaceholder = t('form.format.placeholder');
    $: formatHint = t('form.format.hint');
    $: qualityLabel = t('form.quality.label');
    $: qualityPlaceholder = t('form.quality.placeholder');
    $: qualityHint = t('form.quality.hint');
    
    function parseUrls(): string[] {
        return urls
            .split('\n')
            .map(u => u.trim())
            .filter(u => u.length > 0);
    }
    
    function validateUrls(): boolean {
        urlErrors = [];
        const urlList = parseUrls();
        
        if (urlList.length === 0) {
            urlErrors.push(t('form.urls.required'));
            return false;
        }
        
        for (const url of urlList) {
            try {
                new URL(url);
            } catch {
                urlErrors.push(t('form.urls.invalid', url));
                return false;
            }
        }
        return true;
    }
    
    function handleSubmit(event: Event) {
        event.preventDefault();
        if (!validateUrls()) return;
        
        const urlList = parseUrls();
        const requests: DownloadRequest[] = urlList.map(url => ({
            url: url.trim(),
            targetDirectory: targetDirectory.trim() || undefined,
            format: format.trim() || undefined,
            quality: quality.trim() || undefined,
        }));
        
        onSubmit(requests);
        
        urls = '';
        targetDirectory = '';
        format = '';
        quality = '';
    }
    
    function handlePaste(event: ClipboardEvent) {
        const pastedText = event.clipboardData?.getData('text').trim();
        if (pastedText) {
            urls = pastedText;
        }
    }
    
    function getUrlCount(): number {
        return parseUrls().length;
    }
    
    $: urlCountText = urls.trim() ? t('form.urls.urlCount', getUrlCount()) : '';
</script>

<div class="download-form-container">
    <h2>{formTitle}</h2>
    
    <form on:submit={handleSubmit} class="download-form">
        <div class="form-group">
            <label for="urls">{urlsLabel}</label>
            <textarea
                id="urls"
                bind:value={urls}
                placeholder={urlsPlaceholder}
                on:paste={handlePaste}
                class:invalid={urlErrors.length > 0}
                disabled={isLoading}
                autocomplete="off"
                rows={4}
            ></textarea>
            {#if urls.trim()}
                <span class="url-count">{urlCountText}</span>
            {/if}
            {#if urlErrors.length > 0}
                {#each urlErrors as error}
                    <span class="error-message">{error}</span>
                {/each}
            {/if}
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="targetDirectory">{directoryLabel}</label>
                <div class="input-with-prefix">
                    <span class="prefix">{baseDirectory}/</span>
                    <input
                        id="targetDirectory"
                        type="text"
                        bind:value={targetDirectory}
                        placeholder={directoryPlaceholder}
                        disabled={isLoading}
                    />
                </div>
                <span class="hint">{directoryHint}</span>
            </div>
        </div>
        
        <button type="button" class="toggle-advanced" on:click={() => showAdvanced = !showAdvanced}>
            {advancedText}
        </button>
        
        {#if showAdvanced}
            <div class="advanced-options">
                <div class="form-row">
                    <div class="form-group">
                        <label for="format">{formatLabel}</label>
                        <input
                            id="format"
                            type="text"
                            bind:value={format}
                            placeholder={formatPlaceholder}
                            disabled={isLoading}
                        />
                        <span class="hint">{formatHint}</span>
                    </div>
                    
                    <div class="form-group">
                        <label for="quality">{qualityLabel}</label>
                        <input
                            id="quality"
                            type="text"
                            bind:value={quality}
                            placeholder={qualityPlaceholder}
                            disabled={isLoading}
                        />
                        <span class="hint">{qualityHint}</span>
                    </div>
                </div>
            </div>
        {/if}
        
        <button type="submit" class="btn-primary" disabled={isLoading || urls.trim() === ''}>
            {submitText}
        </button>
    </form>
</div>

<style>
    .download-form-container {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }
    
    .download-form-container h2 {
        margin-bottom: 1.25rem;
        font-size: 1.25rem;
        font-weight: 600;
    }
    
    .download-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }
    
    .form-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
    }
    
    @media (min-width: 640px) {
        .form-row {
            grid-template-columns: 1fr 1fr;
        }
    }
    
    label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-primary);
    }
    
    textarea {
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 0.9375rem;
        font-family: inherit;
        transition: border-color 0.2s, box-shadow 0.2s;
        resize: vertical;
        min-height: 100px;
    }
    
    textarea:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);
    }
    
    textarea.invalid {
        border-color: var(--error);
    }
    
    textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    input[type="text"] {
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 0.9375rem;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);
    }
    
    input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .input-with-prefix {
        display: flex;
        align-items: center;
    }
    
    .prefix {
        padding: 0.625rem 0.875rem;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-right: none;
        border-radius: 8px 0 0 8px;
        color: var(--text-secondary);
        font-size: 0.875rem;
        white-space: nowrap;
    }
    
    .input-with-prefix input {
        border-radius: 0 8px 8px 0;
        flex: 1;
    }
    
    .error-message {
        color: var(--error);
        font-size: 0.75rem;
    }
    
    .url-count {
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-weight: 500;
    }
    
    .hint {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }
    
    .toggle-advanced {
        color: var(--accent);
        font-size: 0.875rem;
        font-weight: 500;
        padding: 0.25rem 0;
        transition: color 0.2s;
    }
    
    .toggle-advanced:hover {
        color: var(--accent-hover);
        text-decoration: underline;
    }
    
    .advanced-options {
        padding-top: 0.5rem;
        border-top: 1px solid var(--border);
        margin-top: 0.5rem;
        animation: slideDown 0.2s ease-out;
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .btn-primary {
        padding: 0.75rem 1.5rem;
        background: var(--accent);
        color: white;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.9375rem;
        transition: background-color 0.2s, transform 0.1s;
        margin-top: 0.5rem;
    }
    
    .btn-primary:hover:not(:disabled) {
        background: var(--accent-hover);
    }
    
    .btn-primary:active:not(:disabled) {
        transform: scale(0.98);
    }
    
    .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
