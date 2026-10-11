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

RUN apk add --no-cache curl

COPY --from=builder /app/build/install/yt-dlp-manager-backend /app

EXPOSE 8080

ENV APP_DOWNLOAD_BASE_DIRECTORY=/downloads

ENTRYPOINT ["/app/bin/yt-dlp-manager-backend"]