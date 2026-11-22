<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { t as getT } from 'svelte-i18n';
    import DownloadForm from '#lib/components/DownloadForm.svelte';
    import DownloadList from '#lib/components/DownloadList.svelte';
    import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
    import { api, createWebSocket } from '#lib/api.ts';
    import type { WebSocketConnection, ConnectionStatus } from '#lib/api.ts';
    import type { DownloadInfo, DownloadRequest, ConfigResponse } from '#lib/types.ts';
    
    let downloads: DownloadInfo[] = [];
    let baseDirectory = '';
    let isLoading = false;
    let connection: WebSocketConnection | null = null;
    let connectionStatus: ConnectionStatus = 'connecting';
    let destroyed = false;
    
    // Reactive translations — $getT creates a dependency on the locale store,
    // so these re-compute when the locale changes.
    $: connectionLabel = connectionStatus === 'connected' ? $getT('connection.connected')
        : connectionStatus === 'connecting' ? $getT('connection.connecting')
        : $getT('connection.disconnected');
    
    async function loadConfig() {
        try {
            const config: ConfigResponse = await api.getConfig();
            baseDirectory = config.baseDirectory;
        } catch (e) {
            console.error('Failed to load config:', e);
        }
    }
    
    // Merge REST results without discarding newer state received over the WebSocket.
    // When submittedIds is given, only those downloads are added.
    function mergeDownloads(current: DownloadInfo[], submittedIds?: Set<string>) {
        const knownIds = new Set(downloads.map(d => d.id));
        const additions = current.filter(d =>
            !knownIds.has(d.id) && (!submittedIds || submittedIds.has(d.id))
        );
        if (additions.length > 0) {
            downloads = [...additions, ...downloads];
        }
    }

    function alertAddError(reasons: unknown[]) {
        const addLabel = $getT('error.add');
        const unknown = $getT('error.unknown');
        const message = reasons
            .map(reason => reason instanceof Error ? reason.message : unknown)
            .join('; ');
        alert(`${addLabel}: ${message}`);
    }

    async function loadDownloads() {
        try {
            mergeDownloads(await api.getDownloads());
        } catch (e) {
            console.error('Failed to load downloads:', e);
        }
    }

    async function handleAddDownload(requests: DownloadRequest[]) {
        try {
            isLoading = true;
            // Keep successful submissions even when another URL in the batch fails.
            const results = await Promise.allSettled(
                requests.map(request => api.addDownload(request))
            );
            // The refresh runs in the background so the form is usable again right away.
            isLoading = false;
            const submittedIds = new Set(
                results.flatMap(result => result.status === 'fulfilled' ? [result.value.id] : [])
            );
            // The WebSocket snapshot may have been missed while it was connecting,
            // so sync the submitted downloads from REST to show them right away.
            if (submittedIds.size > 0) {
                try {
                    mergeDownloads(await api.getDownloads(), submittedIds);
                } catch (e) {
                    console.error('Failed to load downloads after adding:', e);
                }
            }
            const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
            if (failures.length > 0) {
                alertAddError(failures);
            }
        } catch (e) {
            alertAddError([e]);
        } finally {
            isLoading = false;
        }
    }
    
    function handleCancel(id: string) {
        api.cancelDownload(id).catch(e => {
            const cancelLabel = $getT('error.cancel');
            const unknown = $getT('error.unknown');
            alert(`${cancelLabel}: ${e instanceof Error ? e.message : unknown}`);
        });
    }
    
    function connectWebSocket() {
        connection = createWebSocket((download) => {
            const index = downloads.findIndex(d => d.id === download.id);
            if (index >= 0) {
                downloads[index] = download;
            } else {
                downloads = [download, ...downloads];
            }
            downloads = [...downloads]; // Trigger reactivity
        }, (status) => {
            connectionStatus = status;
        });
    }
    
    onMount(async () => {
        await Promise.all([loadConfig(), loadDownloads()]);
        if (!destroyed) connectWebSocket();
    });
    
    onDestroy(() => {
        destroyed = true;
        connection?.close();
    });
</script>

<div class="app">
    <header class="header">
        <div class="header-content">
            <h1>{$getT('app.title')}</h1>
            <div class="connection-indicator" class:connected={connectionStatus === 'connected'} class:disconnected={connectionStatus === 'disconnected'}>
                <span class="dot"></span>
                <span>{connectionLabel}</span>
            </div>
            <LanguageSwitcher />
        </div>
        <p class="base-directory">{$getT('base.directory')}: <code>{baseDirectory}</code></p>
    </header>
    
    <main class="main">
        <DownloadForm 
            onSubmit={handleAddDownload} 
            {isLoading} 
            {baseDirectory} 
        />
        
        <DownloadList 
            {downloads} 
            onCancel={handleCancel} 
        />
    </main>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        max-width: 900px;
        margin: 0 auto;
        padding: 1.5rem;
        width: 100%;
    }
    
    .header {
        margin-bottom: 1.5rem;
    }
    
    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        gap: 1rem;
        flex-wrap: wrap;
    }
    
    .header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        background: linear-gradient(135deg, var(--accent), #ff6b6b);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    
    .connection-indicator {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
    }
    
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-secondary);
    }
    
    .connection-indicator.connected .dot {
        background: var(--success);
        box-shadow: 0 0 8px var(--success);
        animation: pulse 2s ease-in-out infinite;
    }
    
    .connection-indicator.disconnected .dot {
        background: var(--error);
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    .base-directory {
        font-size: 0.875rem;
        color: var(--text-secondary);
    }
    
    .base-directory code {
        font-family: monospace;
        background: var(--bg-tertiary);
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        color: var(--accent);
        font-size: 0.8125rem;
    }
    
    .main {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    
    @media (max-width: 640px) {
        .app {
            padding: 1rem;
        }
        
        .header h1 {
            font-size: 1.5rem;
        }
        
        .header-content {
            flex-direction: column;
            gap: 0.5rem;
            align-items: flex-start;
        }
    }
</style>
