# yt-dlp Manager

A video download manager (YouTube, Twitch, etc.) with a **Kotlin/Ktor backend** and a **TypeScript/SvelteKit frontend**. Uses `yt-dlp` for the actual downloads.

## Features

- 🎬 Video downloads from YouTube, Twitch and many other platforms
- 🗂 Configurable filename pattern (free text or presets)
- 📁 Configurable base download directory
- 📂 Optional relative target directory per download
- 📊 Real-time overview of all downloads (WebSocket)
- ⏯ Start, cancel and track progress of downloads
- 🎨 Modern, responsive UI with dark/light mode
- 🐳 Docker support for easy deployment

## Prerequisites

- **Java 21+** (backend)
- **Node.js 20+** (frontend)
- **pnpm** (frontend package manager)
- **yt-dlp** must be installed system-wide and available in `PATH` for local development. The backend
  Docker image already bundles it (see [Docker deployment](#docker-deployment)).

```bash
# install yt-dlp with uv (do not use pip/pipx)
uv tool install yt-dlp
# or
brew install yt-dlp
# or (standalone binary)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp
```

## Quick start (development)

### 1. Start the backend

```bash
cd backend
./gradlew run
```

The backend runs on `http://localhost:8080` by default.

### 2. Start the frontend (new terminal)

```bash
cd frontend
pnpm install
pnpm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to the backend.

## Configuration

The base download directory is configured in `backend/src/main/resources/application.conf`:

```hocon
app {
    download {
        base-directory = "/home/user/Downloads/yt-dlp-manager"
    }
}
```

Alternatively via environment variable (e.g. in Docker):

```bash
APP_DOWNLOAD_BASE_DIRECTORY=/downloads
```

## Usage

1. **Add download**: enter one or more URLs (one per line), optionally specify a target directory relative to the base directory and a filename pattern (default, preset, or custom yt-dlp template)
2. **Advanced options**: format selector and max. quality
3. **Overview**: all downloads with status, progress, speed and ETA
4. **Cancel**: running downloads can be cancelled
5. **Details**: expand for full metadata including the filename pattern used

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Get base directory |
| GET | `/api/downloads` | List all downloads |
| GET | `/api/downloads/{id}` | Get a single download |
| POST | `/api/downloads` | Start a new download |
| DELETE | `/api/downloads/{id}` | Cancel a download |
| WS | `/api/ws` | WebSocket for real-time updates |

## Docker deployment

```bash
# set download directory
export DOWNLOAD_BASE_DIR=/path/to/downloads

# build and start
docker compose up -d --build
```

Frontend: `http://localhost:3000`
Backend API: `http://localhost:8080`

The backend image bundles `yt-dlp`, installed in an isolated [uv](https://docs.astral.sh/uv/) tool
environment. `pip`/`pipx` are never used and are not installed in the image.

## Project structure

```
yt-dlp-manager/
├── backend/                    # Kotlin/Ktor backend
│   ├── src/main/kotlin/com/ytmanager/
│   │   ├── Application.kt      # main application
│   │   ├── model/              # data models
│   │   ├── service/            # download service (yt-dlp wrapper)
│   │   └── routing/            # API routes
│   └── src/main/resources/
│       ├── application.conf    # configuration
│       └── logback.xml         # logging
├── frontend/                   # SvelteKit frontend
│   ├── src/
│   │   ├── routes/+page.svelte # main page
│   │   ├── lib/
│   │   │   ├── api.ts          # API client + WebSocket
│   │   │   ├── types.ts        # TypeScript types
│   │   │   ├── utils.ts        # helpers
│   │   │   └── components/     # Svelte components
│   │   └── app.css             # global styles
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── Dockerfile
├── .github/
│   ├── workflows/              # CI: build & push images to GHCR
│   └── dependabot.yml          # dependency updates
├── docker-compose.yml          # Docker orchestration
└── AGENTS.md                   # documentation for AI agents
```

## Technical details

### Backend (Kotlin/Ktor)
- **Ktor 2.3** with Netty server
- **Kotlinx Serialization** for JSON
- **Coroutines & Channels** for asynchronous download management
- **WebSockets** for real-time updates
- In-memory storage (no persistence)

### Frontend (SvelteKit/TypeScript)
- **SvelteKit 2** with Vite
- **TypeScript** strict mode
- **WebSocket** with auto-reconnect
- **CSS custom properties** for theming (dark/light)

### yt-dlp integration
The `DownloadService` builds yt-dlp commands dynamically:
- `--no-playlist` (single video only)
- `--restrict-filenames` is used only with the default output template; custom patterns skip it so Unicode and spaces are preserved
- `--output` is configurable — the user can choose from presets ("Default", "Video ID + Title", "Date + Title") or enter a free-text yt-dlp output template
- `%(ext)s` is appended automatically when a custom pattern omits it, because yt-dlp requires the placeholder
- progress parsing via `--progress-template`
- format/quality options are passed through

## CI/CD

GitHub Actions workflows build and push Docker images to the GitHub Container Registry (GHCR):

- `frontend.yml` → `ghcr.io/cyberfuzzie/yt-dlp-manager-frontend`
- `backend.yml` → `ghcr.io/cyberfuzzie/yt-dlp-manager-backend`

The workflows are path-filtered and only run when files in the respective directory change. Images are tagged with the commit SHA; on a Git tag push both images are built and tagged with the release tag.

## License

MIT
