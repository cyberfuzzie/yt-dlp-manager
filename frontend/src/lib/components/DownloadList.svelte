<script lang="ts">
    import type { DownloadInfo, DownloadStatus } from '#lib/types.ts';
    import { STATUS_COLORS, STATUS_DISPLAY_ORDER } from '#lib/types.ts';
    import DownloadItem from './DownloadItem.svelte';
    import { t as getT } from 'svelte-i18n';
    import { tick } from 'svelte';
    
    export let downloads: DownloadInfo[] = [];
    export let onCancel: (id: string) => void;
    
    // Statuses hidden via the filter pills. All buckets are visible by default.
    let hiddenStatuses: DownloadStatus[] = [];
    let filterGroup: HTMLDivElement | undefined = undefined;
    let focusedStatus: DownloadStatus | null = null;
    
    // Counts always describe the full list, regardless of the active filters.
    $: statusCounts = Object.fromEntries(
        STATUS_DISPLAY_ORDER.map(status => [status, downloads.filter(d => d.status === status).length])
    ) as Record<DownloadStatus, number>;
    
    // Keep keyboard focus inside the group if the focused bucket's pill disappears.
    $: if (focusedStatus && statusCounts[focusedStatus] === 0) {
        void restoreFilterFocus();
    }
    
    // A filter for an empty bucket would silently hide downloads that arrive later.
    $: {
        const active = hiddenStatuses.filter(status => statusCounts[status] > 0);
        if (active.length !== hiddenStatuses.length) hiddenStatuses = active;
    }
    
    $: visibleDownloads = downloads.filter(download => !hiddenStatuses.includes(download.status));
    
    $: downloadsByStatus = Object.fromEntries(
        STATUS_DISPLAY_ORDER.map(status => [
            status,
            visibleDownloads
                .filter(download => download.status === status)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        ])
    ) as Record<DownloadStatus, DownloadInfo[]>;
    
    function toggleStatus(status: DownloadStatus): void {
        hiddenStatuses = hiddenStatuses.includes(status)
            ? hiddenStatuses.filter(hidden => hidden !== status)
            : [...hiddenStatuses, status];
    }
    
    function showAll(): void {
        hiddenStatuses = [];
    }
    
    async function restoreFilterFocus(): Promise<void> {
        const group = filterGroup;
        await tick();
        if (group && typeof document !== 'undefined' && !group.contains(document.activeElement)) {
            group.querySelector('button')?.focus();
        }
    }
</script>

<div class="download-list">
    <div role="status" class="sr-only">
        {downloads.length > 0 && visibleDownloads.length === 0 ? $getT('downloadList.allHidden') : ''}
    </div>
    {#if downloads.length === 0}
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M17 10l-5 5-5-5"/>
            </svg>
            <p>{$getT('downloadList.empty')}</p>
            <span>{$getT('downloadList.emptyHint')}</span>
        </div>
    {:else}
        <div class="list-header">
            <h3>{$getT('downloadList.header', { values: { count: downloads.length } })}</h3>
            <div
                class="status-summary"
                role="group"
                aria-label={$getT('downloadList.filters')}
                bind:this={filterGroup}
            >
                <span id="download-filter-hint" class="sr-only">{$getT('downloadList.filterHint')}</span>
                {#each STATUS_DISPLAY_ORDER as status (status)}
                    {@const statusLabel = $getT('status.' + status.toLowerCase())}
                    {#if statusCounts[status] > 0}
                        <button
                            type="button"
                            class="status-count"
                            class:filtered-out={hiddenStatuses.includes(status)}
                            style="--status-color: {STATUS_COLORS[status]}"
                            aria-pressed={hiddenStatuses.includes(status)}
                            aria-describedby="download-filter-hint"
                            title={hiddenStatuses.includes(status)
                                ? $getT('downloadList.showStatus', { values: { status: statusLabel } })
                                : $getT('downloadList.hideStatus', { values: { status: statusLabel } })}
                            on:click={() => toggleStatus(status)}
                            on:focus={() => (focusedStatus = status)}
                            on:blur={() => {
                                if (focusedStatus === status) focusedStatus = null;
                            }}
                        >
                            {statusLabel}: {statusCounts[status]}
                        </button>
                    {/if}
                {/each}
            </div>
        </div>
        
        {#if visibleDownloads.length === 0}
            <div class="empty-state filtered-empty-state">
                <p>{$getT('downloadList.allHidden')}</p>
                <button type="button" class="reset-filters" on:click={showAll}>
                    {$getT('downloadList.showAll')}
                </button>
            </div>
        {:else}
            <div class="downloads-container">
                {#each STATUS_DISPLAY_ORDER as status (status)}
                    {@const statusDownloads = downloadsByStatus[status]}
                    {#if statusDownloads.length > 0}
                        <section class="status-section">
                            <h4 class="status-section-title">
                                <span class="status-dot" style="background: {STATUS_COLORS[status]}"></span>
                                {$getT('status.' + status.toLowerCase())} ({statusDownloads.length})
                            </h4>
                            <div class="status-items">
                                {#each statusDownloads as download (download.id)}
                                    <DownloadItem {download} {onCancel} />
                                {/each}
                            </div>
                        </section>
                    {/if}
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .download-list {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 12px;
        overflow: hidden;
    }
    
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        color: var(--text-secondary);
    }
    
    .empty-icon {
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        opacity: 0.5;
    }
    
    .empty-state p {
        font-size: 1.125rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
    }
    
    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
        background: var(--bg-tertiary);
    }
    
    .list-header h3 {
        font-size: 1rem;
        font-weight: 600;
    }
    
    .status-summary {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    
    .status-count {
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        background: color-mix(in srgb, var(--status-color) 15%, transparent);
        color: var(--status-color);
        border: 1px solid color-mix(in srgb, var(--status-color) 30%, transparent);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }
    
    .status-count:hover {
        background: color-mix(in srgb, var(--status-color) 25%, transparent);
    }
    
    .status-count:focus-visible {
        outline: 2px solid var(--status-color);
        outline-offset: 2px;
    }
    
    .status-count.filtered-out {
        background: var(--bg-primary);
        color: var(--text-secondary);
        border-style: dashed;
        text-decoration: line-through;
    }
    
    .status-count.filtered-out:hover {
        background: var(--bg-secondary);
    }
    
    .filtered-empty-state {
        padding: 3rem 2rem;
    }
    
    .filtered-empty-state p {
        font-size: 1rem;
    }
    
    .reset-filters {
        font-family: inherit;
        font-size: 0.875rem;
        color: var(--text-primary);
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 0.5rem 0.875rem;
        cursor: pointer;
    }
    
    .reset-filters:hover {
        background: var(--bg-tertiary);
    }
    
    .reset-filters:focus-visible {
        outline: 2px solid var(--text-primary);
        outline-offset: 2px;
    }
    
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
    
    .downloads-container {
        padding: 1rem 1.5rem;
        max-height: 70vh;
        overflow-y: auto;
    }
    
    .status-section:not(:first-child) {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border);
    }
    
    .status-section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.75rem;
    }
    
    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    
    .status-items {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
</style>
