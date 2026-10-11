<script lang="ts">
    import type { DownloadStatus } from '#lib/types.ts';
    import { STATUS_COLORS } from '#lib/types.ts';
    import { createT } from '#lib/i18n.ts';

    export let status: DownloadStatus = 'PENDING';
    export let showLabel = true;
    
    const tFn = createT();
    
    $: label = tFn('status.' + status.toLowerCase());
</script>

<span 
    class="status-badge" 
    style="--status-color: {STATUS_COLORS[status]}"
    title={label}
>
    <span class="status-dot"></span>
    {#if showLabel}
        <span class="status-label">{label}</span>
    {/if}
</span>

<style>
    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        background: color-mix(in srgb, var(--status-color) 15%, transparent);
        color: var(--status-color);
        border: 1px solid color-mix(in srgb, var(--status-color) 30%, transparent);
    }
    
    .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--status-color);
        flex-shrink: 0;
    }
    
    .status-dot::after {
        content: '';
    }
    
    .status-badge:has(.status-dot) {
        /* Pulsing animation for downloading status */
    }
    
    .status-badge[data-status="DOWNLOADING"] .status-dot {
        animation: pulse 1.5s ease-in-out infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
    }
</style>
