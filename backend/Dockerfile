FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
COPY gradlew ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon

COPY src ./src
# `check` runs the test suite and enforces the 80% JaCoCo line-coverage gate.
RUN ./gradlew check installDist --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# `uv` is copied from its official image (the `-alpine` tag ships a musl build). It is used to
# install yt-dlp as an isolated tool environment; pip/pipx are never used or installed.
COPY --from=ghcr.io/astral-sh/uv:0.13.0-alpine /usr/local/bin/uv /usr/local/bin/uvx /usr/local/bin/

# python3 comes from Alpine without pip (pip is a separate `py3-pip` package). uv creates its own
# virtualenv for yt-dlp, so the system interpreter is used read-only and stays pip-free.
RUN apk add --no-cache curl python3 \
    && UV_TOOL_BIN_DIR=/usr/local/bin uv tool install --python /usr/bin/python3 yt-dlp \
    && rm -rf /root/.cache/uv \
    && mkdir -p /downloads \
    && yt-dlp --version

COPY --from=builder /app/build/install/yt-dlp-manager-backend /app

EXPOSE 8080

ENV APP_DOWNLOAD_BASE_DIRECTORY=/downloads

ENTRYPOINT ["/app/bin/yt-dlp-manager-backend"]