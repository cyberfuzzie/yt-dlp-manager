<script lang="ts">
    import type { DownloadInfo } from '#lib/types.ts';
    import StatusBadge from './StatusBadge.svelte';
    import { formatRelativeTime, formatBytes, truncate, extractDomain } from '#lib/utils.ts';
    import { api } from '#lib/api.ts';
    import { t as getT } from 'svelte-i18n';
    import { unwrapT } from '#lib/i18n.ts';
    
    export let download!: DownloadInfo;
    export let onCancel: (id: string) => void;
    
    let showDetails = false;
    let isCancelling = false;
    
    async function handleCancel() {
        if (isCancelling) return;
        isCancelling = true;
        try {
            await onCancel(download.id);
        } finally {
            isCancelling = false;
        }
    }
    
    function getProgressColor(): string {
        const p = download.progress ?? 0;
        if (p < 30) return '#fbbf24';
        if (p < 70) return '#3b82f6';
        return '#22c55e';
    }
    
    function copyUrl() {
        navigator.clipboard.writeText(download.url);
    }
    
    $: relativeTime = formatRelativeTime(download.createdAt, unwrapT);
</script>

<article class="download-item" class:completed={download.status === 'COMPLETED'} class:failed={download.status === 'FAILED'}>
    <div class="item-header">
        <div class="item-info">
            <div class="item-url" title={download.url}>
                <span class="domain">{extractDomain(download.url)}</span>
                <span class="path">{truncate(download.url, 60)}</span>
            </div>
            <div class="item-meta">
                <span class="created-at">{$getT('downloadItem.added')}: {relativeTime}</span>
                {#if download.targetDirectory}
                    <span class="target-dir">📁 {download.targetDirectory}</span>
                {/if}
            </div>
        </div>
        
        <div class="item-actions">
            <StatusBadge status={download.status} />
            <button 
                class="btn-icon" 
                on:click={() => showDetails = !showDetails}
                aria-label={$getT(showDetails ? 'downloadItem.hideDetails' : 'downloadItem.showDetails')}
                title={$getT(showDetails ? 'downloadItem.hideDetails' : 'downloadItem.showDetails')}
            >
                {showDetails ? '▲' : '▼'}
            </button>
            {#if download.status === 'PENDING' || download.status === 'DOWNLOADING'}
                <button 
                    class="btn-icon btn-danger" 
                    on:click={handleCancel}
                    disabled={isCancelling}
                    aria-label={$getT('downloadItem.cancel')}
                    title={$getT('downloadItem.cancel')}
                >
                    ✕
                </button>
            {/if}
        </div>
    </div>
    
    {#if download.status === 'DOWNLOADING'}
        <div class="progress-container">
            <div 
                class="progress-bar" 
                style="width: {(download.progress ?? 0)}%; background: {getProgressColor()};"
            ></div>
            <span class="progress-text">{(download.progress ?? 0).toFixed(1)}%</span>
        </div>
        <div class="progress-meta">
            {#if download.speed}
                <span class="speed">⚡ {download.speed}</span>
            {/if}
            {#if download.eta}
                <span class="eta">⏱ {download.eta}</span>
            {/if}
        </div>
    {:else if download.status === 'COMPLETED' && download.filename}
        <div class="completed-info">
            <span class="filename">📄 {download.filename}</span>
            {#if download.fileSize}
                <span class="filesize">{formatBytes(download.fileSize)}</span>
            {/if}
        </div>
    {:else if download.status === 'FAILED' && download.errorMessage}
        <div class="error-info">
            <span class="error-icon">⚠</span>
            <span class="error-text">{download.errorMessage}</span>
            <button class="btn-copy" on:click={copyUrl} title={$getT('downloadItem.copyUrl')}>📋</button>
        </div>
    {/if}
    
    {#if showDetails}
        <div class="details-panel">
            <div class="detail-row">
                <span class="detail-label">{$getT('downloadItem.idLabel')}</span>
                <span class="detail-value mono">{download.id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">{$getT('downloadItem.urlLabel')}</span>
                <span class="detail-value url" title={download.url}>{download.url}</span>
            </div>
            {#if download.targetDirectory}
                <div class="detail-row">
                    <span class="detail-label">{$getT('downloadItem.directoryLabel')}</span>
                    <span class="detail-value">{download.targetDirectory}</span>
                </div>
            {/if}
            {#if download.format}
                <div class="detail-row">
                    <span class="detail-label">{$getT('downloadItem.formatLabel')}</span>
                    <span class="detail-value mono">{download.format}</span>
                </div>
            {/if}
            {#if download.quality}
                <div class="detail-row">
                    <span class="detail-label">{$getT('downloadItem.qualityLabel')}</span>
                    <span class="detail-value mono">{download.quality}</span>
                </div>
            {/if}
            <div class="detail-row">
                <span class="detail-label">{$getT('downloadItem.createdLabel')}</span>
                <span class="detail-value">{new Date(download.createdAt).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {#if download.startedAt}
                <div class="detail-row">
                    <span class="detail-label">{$getT('downloadItem.startedLabel')}</span>
                    <span class="detail-value">{new Date(download.startedAt).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            {/if}
            {#if download.completedAt}
                <div class="detail-row">
                    <span class="detail-label">{$getT('downloadItem.completedLabel')}</span>
                    <span class="detail-value">{new Date(download.completedAt).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            {/if}
        </div>
    {/if}
</article>

<style>
    .download-item {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    .download-item:hover {
        border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
        box-shadow: 0 4px 12px var(--shadow);
    }
    
    .download-item.completed {
        border-color: color-mix(in srgb, var(--success) 30%, var(--border));
    }
    
    .download-item.failed {
        border-color: color-mix(in srgb, var(--error) 30%, var(--border));
    }
    
    .item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.75rem;
    }
    
    .item-info {
        flex: 1;
        min-width: 0;
    }
    
    .item-url {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
    }
    
    .domain {
        background: var(--bg-tertiary);
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--accent);
    }
    
    .path {
        font-size: 0.875rem;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
    }
    
    .target-dir {
        font-family: monospace;
        background: var(--bg-tertiary);
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
    }
    
    .item-actions {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        flex-shrink: 0;
    }
    
    .btn-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: var(--text-secondary);
        font-size: 0.875rem;
        transition: all 0.2s;
    }
    
    .btn-icon:hover:not(:disabled) {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }
    
    .btn-icon.btn-danger:hover:not(:disabled) {
        background: color-mix(in srgb, var(--error) 20%, var(--bg-tertiary));
        color: var(--error);
    }
    
    .btn-icon:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .progress-container {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
    }
    
    .progress-bar {
        height: 6px;
        border-radius: 3px;
        background: var(--bg-tertiary);
        overflow: hidden;
        flex: 1;
    }
    
    .progress-bar > div {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease-out;
    }
    
    .progress-text {
        font-size: 0.875rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        min-width: 4.5rem;
        text-align: right;
    }
    
    .progress-meta {
        display: flex;
        gap: 1rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
    }
    
    .completed-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding-top: 0.5rem;
        color: var(--text-secondary);
        font-size: 0.875rem;
    }
    
    .filename {
        flex: 1;
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .filesize {
        font-variant-numeric: tabular-nums;
    }
    
    .error-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: color-mix(in srgb, var(--error) 10%, var(--bg-tertiary));
        border-radius: 8px;
        color: var(--error);
        font-size: 0.875rem;
    }
    
    .error-icon {
        flex-shrink: 0;
    }
    
    .error-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .btn-copy {
        padding: 0.25rem 0.5rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 4px;
        font-size: 0.875rem;
        transition: all 0.2s;
    }
    
    .btn-copy:hover {
        background: var(--bg-tertiary);
        border-color: var(--accent);
    }
    
    .details-panel {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
        animation: slideDown 0.2s ease-out;
    }
    
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .detail-row {
        display: flex;
        gap: 1rem;
        padding: 0.375rem 0;
        font-size: 0.8125rem;
    }
    
    .detail-label {
        min-width: 100px;
        color: var(--text-secondary);
        font-weight: 500;
        flex-shrink: 0;
    }
    
    .detail-value {
        flex: 1;
        word-break: break-all;
        color: var(--text-primary);
    }
    
    .detail-value.mono {
        font-family: monospace;
        font-size: 0.75rem;
        background: var(--bg-tertiary);
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
    }
    
    .detail-value.url {
        font-family: monospace;
        font-size: 0.75rem;
    }
</style>
