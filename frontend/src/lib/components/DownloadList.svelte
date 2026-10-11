<script lang="ts">
    import type { DownloadInfo, DownloadStatus } from '$lib/types';
    import DownloadItem from './DownloadItem.svelte';
    import { STATUS_LABELS } from '$lib/types';
    
    export let downloads: DownloadInfo[] = [];
    export let onCancel: (id: string) => void;
    
    const statusOrder: DownloadStatus[] = ['DOWNLOADING', 'PENDING', 'FAILED', 'COMPLETED', 'CANCELLED'];
    
    $: sortedDownloads = [...downloads].sort((a, b) => {
        const statusA = statusOrder.indexOf(a.status);
        const statusB = statusOrder.indexOf(b.status);
        if (statusA !== statusB) return statusA - statusB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    $: downloadsByStatus = Object.fromEntries(
        Object.values(STATUS_LABELS).map(label => [label, sortedDownloads.filter(d => STATUS_LABELS[d.status] === label)])
    ) as Record<string, DownloadInfo[]>;
    
    function getStatusCounts(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const status of Object.keys(STATUS_LABELS) as DownloadStatus[]) {
            counts[STATUS_LABELS[status]] = downloads.filter(d => d.status === status).length;
        }
        return counts;
    }
    
    $: statusCounts = getStatusCounts();
    
    function getStatusColor(label: string): string {
        const status = Object.entries(STATUS_LABELS).find(([, v]) => v === label)?.[0] as keyof typeof STATUS_LABELS;
        const colors: Record<string, string> = {
            PENDING: '#fbbf24',
            DOWNLOADING: '#3b82f6',
            COMPLETED: '#22c55e',
            FAILED: '#ef4444',
            CANCELLED: '#6b7280',
        };
        return colors[status] || '#6b7280';
    }
</script>

<div class="download-list">
    {#if downloads.length === 0}
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M17 10l-5 5-5-5"/>
            </svg>
            <p>Keine Downloads vorhanden</p>
            <span>Füge oben einen neuen Download hinzu</span>
        </div>
    {:else}
        <div class="list-header">
            <h3>Downloads ({downloads.length})</h3>
            <div class="status-summary">
                {#each Object.entries(statusCounts) as [label, count]}
                    {#if count > 0}
                        <span class="status-count" style="--status-color: {getStatusColor(label)}">
                            {label}: {count}
                        </span>
                    {/if}
                {/each}
            </div>
        </div>
        
        <div class="downloads-container">
            {#each Object.entries(downloadsByStatus) as [statusLabel, statusDownloads]}
                {#if statusDownloads.length > 0}
                    <section class="status-section">
                        <h4 class="status-section-title">
                            <span class="status-dot" style="background: {getStatusColor(statusLabel)}"></span>
                            {statusLabel} ({statusDownloads.length})
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
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        background: color-mix(in srgb, var(--status-color) 15%, transparent);
        color: var(--status-color);
        border: 1px solid color-mix(in srgb, var(--status-color) 30%, transparent);
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