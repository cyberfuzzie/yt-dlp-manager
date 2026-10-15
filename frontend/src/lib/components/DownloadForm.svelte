<script lang="ts">
    import type { DownloadRequest } from '#lib/types.ts';
    import { onMount } from 'svelte';
    import { t as getT } from 'svelte-i18n';
    import { unwrapT } from '#lib/i18n.ts';

    export let onSubmit: (requests: DownloadRequest[]) => void;
    export let isLoading = false;
    export let baseDirectory = '';

    let urls = '';
    let targetDirectory = '';
    let format = '';
    let quality = '';
    let showAdvanced = false;
    let urlErrors: string[] = [];
    let filenamePreset = 'default';
    let customFilenamePattern = '';
    const FILENAME_PRESETS: Record<string, string | undefined> = {
        default: undefined,
        idTitle: '%(id)s %(title)s.%(ext)s',
        dateTitle: '%(upload_date>%Y-%m-%d)s %(title)s.%(ext)s',
    };
    
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
            urlErrors.push(unwrapT('form.urls.required'));
            return false;
        }
        
        for (const url of urlList) {
            try {
                new URL(url);
            } catch {
                urlErrors.push(unwrapT('form.urls.invalid', { url }));
                return false;
            }
        }
        return true;
    }
    
    function handleSubmit(event: Event) {
        event.preventDefault();
        if (!validateUrls()) return;
        
        const urlList = parseUrls();
        const filenamePattern = filenamePreset === 'custom'
            ? customFilenamePattern.trim() || undefined
            : FILENAME_PRESETS[filenamePreset];
        const requests: DownloadRequest[] = urlList.map(url => ({
            url: url.trim(),
            targetDirectory: targetDirectory.trim() || undefined,
            format: format.trim() || undefined,
            quality: quality.trim() || undefined,
            filenamePattern,
        }));
        
        onSubmit(requests);
        
        urls = '';
        targetDirectory = '';
        format = '';
        quality = '';
        filenamePreset = 'default';
        customFilenamePattern = '';
    }
    
    function handlePaste(event: ClipboardEvent) {
        const pastedText = event.clipboardData?.getData('text').trim();
        if (pastedText) {
            urls = pastedText;
        }
    }
</script>

<div class="download-form-container">
    <h2>{$getT('form.title')}</h2>
    
    <form on:submit={handleSubmit} class="download-form">
        <div class="form-group">
            <label for="urls">{$getT('form.urls.label')}</label>
            <textarea
                id="urls"
                bind:value={urls}
                placeholder={$getT('form.urls.placeholder')}
                on:paste={handlePaste}
                class:invalid={urlErrors.length > 0}
                disabled={isLoading}
                autocomplete="off"
                rows={4}
            ></textarea>
            {#if urls.trim()}
                    <span class="url-count">
                        {parseUrls().length === 1 
                            ? $getT('form.urls.urlCountSingular', { values: { n: parseUrls().length } })
                            : $getT('form.urls.urlCountPlural', { values: { n: parseUrls().length } })
                        }
                    </span>
            {/if}
            {#if urlErrors.length > 0}
                {#each urlErrors as error, index (index)}
                    <span class="error-message">{error}</span>
                {/each}
            {/if}
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="targetDirectory">{$getT('form.directory.label')}</label>
                <div class="input-with-prefix">
                    <span class="prefix">{baseDirectory}/</span>
                    <input
                        id="targetDirectory"
                        type="text"
                        bind:value={targetDirectory}
                        placeholder={$getT('form.directory.placeholder')}
                        disabled={isLoading}
                    />
                </div>
                <span class="hint">{$getT('form.directory.hint')}</span>
            </div>
        </div>
        
        <div class="form-group">
            <label for="filenamePreset">{$getT('form.filenamePattern.label')}</label>
            <select id="filenamePreset" bind:value={filenamePreset} disabled={isLoading}>
                <option value="default">{$getT('form.filenamePattern.default')}</option>
                <option value="idTitle">{$getT('form.filenamePattern.idTitle')}</option>
                <option value="dateTitle">{$getT('form.filenamePattern.dateTitle')}</option>
                <option value="custom">{$getT('form.filenamePattern.custom')}</option>
            </select>
            <span class="hint">{$getT('form.filenamePattern.hint')}</span>
        </div>
        {#if filenamePreset === 'custom'}
            <div class="form-group">
                <label for="filenamePattern">{$getT('form.filenamePattern.customLabel')}</label>
                <input
                    id="filenamePattern"
                    type="text"
                    bind:value={customFilenamePattern}
                    placeholder={$getT('form.filenamePattern.placeholder')}
                    disabled={isLoading}
                />
            </div>
        {/if}
        
        <button type="button" class="toggle-advanced" on:click={() => showAdvanced = !showAdvanced}>
            {showAdvanced ? $getT('form.advancedLess') : $getT('form.advanced')}
        </button>
        
        {#if showAdvanced}
            <div class="advanced-options">
                <div class="form-row">
                    <div class="form-group">
                        <label for="format">{$getT('form.format.label')}</label>
                        <input
                            id="format"
                            type="text"
                            bind:value={format}
                            placeholder={$getT('form.format.placeholder')}
                            disabled={isLoading}
                        />
                        <span class="hint">{$getT('form.format.hint')}</span>
                    </div>
                    
                    <div class="form-group">
                        <label for="quality">{$getT('form.quality.label')}</label>
                        <input
                            id="quality"
                            type="text"
                            bind:value={quality}
                            placeholder={$getT('form.quality.placeholder')}
                            disabled={isLoading}
                        />
                        <span class="hint">{$getT('form.quality.hint')}</span>
                    </div>
                </div>
            </div>
        {/if}
        
        <button type="submit" class="btn-primary" disabled={isLoading || urls.trim() === ''}>
            {isLoading ? $getT('form.submitting') : $getT('form.submit')}
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
    
    select {
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 0.9375rem;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    input:focus,
    select:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);
    }
    
    input:disabled,
    select:disabled {
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
