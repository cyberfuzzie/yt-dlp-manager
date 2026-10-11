<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { createT } from '#lib/i18n.ts';
    import DownloadForm from '#lib/components/DownloadForm.svelte';
    import DownloadList from '#lib/components/DownloadList.svelte';
    import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
    import { api, createWebSocket } from '#lib/api.ts';
    import type { DownloadInfo, DownloadRequest, ConfigResponse } from '#lib/types.ts';
    
    let downloads: DownloadInfo[] = [];
    let baseDirectory = '';
    let isLoading = false;
    let ws: WebSocket | null = null;
    let connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'connecting';
    
    const tFn = createT();
    
    // Reactive translations
    $: connectionLabel = connectionStatus === 'connected' ? tFn('connection.connected')
        : connectionStatus === 'connecting' ? tFn('connection.connecting')
        : tFn('connection.disconnected');
    
    async function loadConfig() {
        try {
            const config: ConfigResponse = await api.getConfig();
            baseDirectory = config.baseDirectory;
        } catch (e) {
            console.error('Failed to load config:', e);
        }
    }
    
    async function loadDownloads() {
        try {
            downloads = await api.getDownloads();
        } catch (e) {
            console.error('Failed to load downloads:', e);
        }
    }
    
    async function handleAddDownload(requests: DownloadRequest[]) {
        try {
            isLoading = true;
            // Start all downloads in parallel
            await Promise.all(
                requests.map(request => api.addDownload(request))
            );
            // The WebSocket will update the list
        } catch (e) {
            alert(`${tFn('error.add')}: ${e instanceof Error ? e.message : tFn('error.unknown')}`);
        } finally {
            isLoading = false;
        }
    }
    
    function handleCancel(id: string) {
        api.cancelDownload(id).catch(e => {
            alert(`${tFn('error.cancel')}: ${e instanceof Error ? e.message : tFn('error.unknown')}`);
        });
    }
    
    function connectWebSocket() {
        ws = createWebSocket((download) => {
            const index = downloads.findIndex(d => d.id === download.id);
            if (index >= 0) {
                downloads[index] = download;
            } else {
                downloads = [download, ...downloads];
            }
            downloads = [...downloads]; // Trigger reactivity
        });
        
        ws.onopen = () => {
            connectionStatus = 'connected';
        };
        
        ws.onclose = () => {
            connectionStatus = 'disconnected';
        };
        
        ws.onerror = () => {
            connectionStatus = 'disconnected';
        };
    }
    
    onMount(async () => {
        await Promise.all([loadConfig(), loadDownloads()]);
        connectWebSocket();
    });
    
    onDestroy(() => {
        ws?.close();
    });
</script>

<div class="app">
    <header class="header">
        <div class="header-content">
            <h1>{tFn('app.title')}</h1>
            <div class="connection-indicator" class:connected={connectionStatus === 'connected'} class:disconnected={connectionStatus === 'disconnected'}>
                <span class="dot"></span>
                <span>{connectionLabel}</span>
            </div>
            <LanguageSwitcher />
        </div>
        <p class="base-directory">{tFn('base.directory')}: <code>{baseDirectory}</code></p>
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
