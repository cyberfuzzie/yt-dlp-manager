# AGENTS.md

This document is written for AI agents (and humans) working on this repository. It describes the project, the conventions, and how to build, test, and run it.

## Language convention

**English is the project language.** All documentation, source code comments, commit messages, pull request titles, and this file must be written in English. Do not introduce comments, docs, logs, or identifiers in other languages. (User-facing UI strings may be localized separately, but code comments and docs stay in English.)

## What this project is

`yt-dlp-manager` is a self-hosted video download manager (YouTube, Twitch, etc.). It consists of two independently buildable and deployable parts:

- **Backend** (`backend/`): Kotlin/Ktor REST + WebSocket API that shells out to `yt-dlp` and tracks download state in memory.
- **Frontend** (`frontend/`): SvelteKit/TypeScript SPA served as static files by nginx, talking to the backend through `/api` and a WebSocket.

There is **no persistence** — all download state is held in memory and is lost when the backend restarts.

## Repository layout

```
yt-dlp-manager/
├── backend/                 # Kotlin/Ktor, Gradle build (Java 21)
├── frontend/                # SvelteKit/TypeScript, pnpm build
├── .github/
│   ├── workflows/           # frontend.yml, backend.yml (build + push to GHCR)
│   └── dependabot.yml       # automated dependency updates
├── docker-compose.yml       # runs both services locally
├── README.md                # user-facing documentation (English)
└── AGENTS.md                # this file
```

Note: there is intentionally **no root `package.json`**. The frontend is a standalone pnpm project with its own `pnpm-lock.yaml`. Do not re-introduce a pnpm workspace or a root lockfile.

## Build & run

### Backend
```bash
cd backend
./gradlew run          # dev server on http://localhost:8080
./gradlew build        # assemble JAR/distribution
```
- Java 21 toolchain (see `backend/build.gradle.kts`).
- Base download directory: `backend/src/main/resources/application.conf` (`app.download.base-directory`), overridable with `APP_DOWNLOAD_BASE_DIRECTORY`.
- `yt-dlp` must be installed and on `PATH` for downloads to work.

### Frontend
```bash
cd frontend
pnpm install           # on first run, approve build scripts: pnpm approve-builds esbuild svelte-preprocess
pnpm run dev           # dev server on http://localhost:5173, proxies /api -> :8080
pnpm run build         # static build into frontend/build (adapter-static)
pnpm run check         # svelte-check type checking
```
- pnpm only (the lockfile is `frontend/pnpm-lock.yaml`).
- Production serving uses `@sveltejs/adapter-static` behind nginx (`frontend/nginx.conf`), which proxies `/api` and `/api/ws` to the backend.

### Docker
```bash
export DOWNLOAD_BASE_DIR=/path/to/downloads
docker compose up -d --build
```
- Frontend: http://localhost:3000 (nginx), Backend API: http://localhost:8080.

## Architecture notes

- **Backend**: `Application.kt` wires Ktor plugins (CORS, ContentNegotiation, WebSockets, CallId, CallLogging). `DownloadService` launches `yt-dlp` as a subprocess, parses its `--progress-template` output, and pushes `DownloadInfo` updates onto a `Channel`. `ApiRoutes` exposes REST endpoints and a `/api/ws` WebSocket that streams `{ "type": "download_update", "payload": DownloadInfo }` messages.
- **Frontend**: `src/lib/api.ts` is the API client (REST + WebSocket with auto-reconnect). `src/lib/types.ts` defines the shared TypeScript types. Components live in `src/lib/components/`.
- **Type vs. value gotcha**: `DownloadStatus` is a TypeScript *type* (a string union), not a runtime enum. Never use it as a value (e.g. `Object.values(DownloadStatus)`); iterate over `Object.keys(STATUS_LABELS)` instead.

## CI/CD conventions

- GitHub Actions builds Docker images and pushes them to GHCR.
- Workflows are **path-filtered**: `frontend.yml` runs only when `frontend/**` (or its own workflow file) changes; `backend.yml` only when `backend/**` changes. Path filters are **not** evaluated for tag pushes, so a Git tag builds **both** images.
- Image names: `ghcr.io/cyberfuzzie/yt-dlp-manager-frontend` and `ghcr.io/cyberfuzzie/yt-dlp-manager-backend` (lowercase).
- Tagging: branch pushes are tagged with the commit SHA (`github.sha`); tag pushes are tagged with the tag name (`github.ref_name`).

## Dependabot

`.github/dependabot.yml` keeps `gradle` (backend), `npm`/pnpm (frontend) and `github-actions` (workflows) up to date on a weekly schedule.

## When making changes

1. Keep documentation and comments in English.
2. Run `pnpm run check` after frontend changes; run `./gradlew build` after backend changes.
3. Do not add a root `package.json`, pnpm workspace, or persistence layer unless explicitly requested.
4. Commit messages: concise, imperative, English (e.g. "Add WebSocket reconnect handling").
