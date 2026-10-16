package com.ytmanager.service

import com.ytmanager.model.DownloadInfo
import com.ytmanager.model.DownloadRequest
import com.ytmanager.model.DownloadStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import java.io.File
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class DownloadService(
    private val baseDirectory: String,
    val updateChannel: Channel<DownloadInfo>,
    private val ytDlpExecutable: String = "yt-dlp",
) {
    private val downloads = ConcurrentHashMap<String, DownloadInfo>()
    private val activeProcesses = ConcurrentHashMap<String, Process>()
    private val providerWorkers = ConcurrentHashMap<String, Channel<String>>()

    companion object {
        private val TERMINAL_STATUSES = setOf(
            DownloadStatus.COMPLETED,
            DownloadStatus.FAILED,
            DownloadStatus.CANCELLED,
        )

        /**
         * Extracts a provider key from a URL by lowercasing the host and stripping
         * a leading `www.` prefix.  Falls back to the trimmed raw URL when parsing
         * fails or no host is present, so unparseable URLs never block each other.
         */
        internal fun providerKey(url: String): String {
            return try {
                val uri = java.net.URI(url)
                val host = uri.host
                if (host != null) {
                    host.lowercase().removePrefix("www.")
                } else {
                    url.trim()
                }
            } catch (e: Exception) {
                url.trim()
            }
        }

        /** yt-dlp output template used when no custom pattern is supplied. */
        internal const val DEFAULT_OUTPUT_TEMPLATE = "%(title)s [%(id)s].%(ext)s"
        private const val EXT_PLACEHOLDER = "%(ext)s"
    }

    fun getAllDownloads(): List<DownloadInfo> =
        downloads.values.toList().sortedByDescending { it.createdAt }

    fun getDownload(id: String): DownloadInfo? = downloads[id]

    suspend fun addDownload(request: DownloadRequest): DownloadInfo {
        val download = DownloadInfo(
            url = request.url,
            targetDirectory = request.targetDirectory,
            format = request.format,
            quality = request.quality,
            filenamePattern = request.filenamePattern,
        )

        downloads[download.id] = download
        updateChannel.send(download.copy())

        val key = providerKey(request.url)
        val newChannel = Channel<String>(Channel.UNLIMITED)
        val channel = providerWorkers.putIfAbsent(key, newChannel) ?: newChannel.also {
            startWorker(key, it)
        }
        channel.send(download.id)

        return download
    }

    private fun startWorker(key: String, channel: Channel<String>) {
        CoroutineScope(Dispatchers.IO).launch {
            for (id in channel) {
                val info = downloads[id] ?: continue
                if (!tryStart(id)) continue

                val process = try {
                    val targetDir = resolveTargetDirectory(info.targetDirectory)
                    targetDir.mkdirs()
                    val command = buildYtDlpCommand(info, targetDir)
                    ProcessBuilder(*command.toTypedArray())
                        .directory(targetDir)
                        .redirectErrorStream(true)
                        .start()
                } catch (e: Exception) {
                    updateStatus(id, DownloadStatus.FAILED, errorMessage = e.message ?: "Unknown error", completedAt = Instant.now())
                    continue
                }
                activeProcesses[id] = process

                // Guard against cancellation between process registration and drain.
                if (downloads[id]?.status == DownloadStatus.CANCELLED) {
                    process.destroyForcibly()
                }

                try {
                    val output = StringBuilder()
                    val inputStream = process.inputStream.bufferedReader()
                    while (true) {
                        val line = inputStream.readLine() ?: break
                        output.append(line).append("\n")
                        parseProgress(line, id)
                    }
                    val exitCode = process.waitFor()
                    activeProcesses.remove(id)
                    // Atomically transition to terminal status; skip if already CANCELLED.
                    downloads.computeIfPresent(id) { _, info ->
                        if (info.status in TERMINAL_STATUSES) info
                        else {
                            val updated = if (exitCode == 0) {
                                val filename = extractFilename(output.toString()) ?: "unknown"
                                info.copy(
                                    status = DownloadStatus.COMPLETED,
                                    filename = filename,
                                    completedAt = Instant.now(),
                                    progress = 100.0,
                                )
                            } else {
                                info.copy(
                                    status = DownloadStatus.FAILED,
                                    errorMessage = "yt-dlp exited with code $exitCode: ${output.takeLast(500)}",
                                    completedAt = Instant.now(),
                                )
                            }
                            try {
                                updateChannel.trySend(updated)
                            } catch (e: Exception) {
                                // Channel full or closed, ignore
                            }
                            updated
                        }
                    }
                } catch (e: Exception) {
                    activeProcesses.remove(id)
                    // Same atomic pattern for exceptions.
                    downloads.computeIfPresent(id) { _, info ->
                        if (info.status in TERMINAL_STATUSES) info
                        else {
                            val updated = info.copy(
                                status = DownloadStatus.FAILED,
                                errorMessage = e.message ?: "Unknown error",
                                completedAt = Instant.now(),
                            )
                            try {
                                updateChannel.trySend(updated)
                            } catch (e: Exception) {
                                // Channel full or closed, ignore
                            }
                            updated
                        }
                    }
                }
            }
        }
    }

    private fun resolveTargetDirectory(relativePath: String?): File {
        val base = File(baseDirectory)
        return if (relativePath != null && relativePath.isNotBlank()) {
            File(base, relativePath)
        } else {
            base
        }
    }

    private fun buildYtDlpCommand(download: DownloadInfo, targetDir: File): List<String> {
        val command = mutableListOf<String>(ytDlpExecutable)

        command.add("--no-playlist")

        val customPattern = download.filenamePattern?.takeIf { it.isNotBlank() }
        if (customPattern == null) {
            command.add("--restrict-filenames")
        }
        command.add("--output")
        command.add(normalizeOutputTemplate(customPattern ?: DEFAULT_OUTPUT_TEMPLATE))

        download.format?.let { command.add("--format"); command.add(it) }
        download.quality?.let {
            command.add("--format")
            command.add("bestvideo[height<=${it}]+bestaudio/best[height<=${it}]")
        }

        command.add("--newline")
        command.add("--progress-template")
        command.add("download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s")

        command.add(download.url)

        return command
    }

    private fun parseProgress(line: String, downloadId: String) {
        if (line.startsWith("download:")) {
            val parts = line.substringAfter("download:").split("|")
            if (parts.size >= 3) {
                val progressStr = parts[0].replace("%", "").trim()
                val speed = parts[1].trim()
                val eta = parts[2].trim()

                progressStr.toDoubleOrNull()?.let { progress ->
                    updateProgress(downloadId, progress, speed, eta)
                }
            }
        } else if (line.contains("[download]") && line.contains("%")) {
            val percentMatch = """(\d+\.?\d*)%""".toRegex().find(line)
            percentMatch?.groupValues?.get(1)?.toDoubleOrNull()?.let { progress ->
                val speedMatch = """at\s+([\d.]+\w?/s)""".toRegex().find(line)
                val etaMatch = """ETA\s+([\d:]+)""".toRegex().find(line)
                updateProgress(
                    downloadId,
                    progress,
                    speedMatch?.groupValues?.get(1),
                    etaMatch?.groupValues?.get(1),
                )
            }
        }
    }

    private fun updateProgress(id: String, progress: Double, speed: String?, eta: String?) {
        downloads.computeIfPresent(id) { _, info ->
            val updated = info.copy(
                progress = progress.coerceIn(0.0, 100.0),
                speed = speed,
                eta = eta,
            )
            try {
                updateChannel.trySend(updated)
            } catch (e: Exception) {
                // Channel full or closed, ignore
            }
            updated
        }
    }

    private fun updateStatus(
        id: String,
        status: DownloadStatus,
        startedAt: Instant? = null,
        completedAt: Instant? = null,
        progress: Double? = null,
        filename: String? = null,
        errorMessage: String? = null,
    ) {
        downloads.computeIfPresent(id) { _, info ->
            // Terminal status guard: do not overwrite terminal statuses
            if (info.status in TERMINAL_STATUSES) {
                return@computeIfPresent info
            }

            val updated = info.copy(
                status = status,
                startedAt = startedAt ?: info.startedAt,
                completedAt = completedAt,
                progress = progress ?: info.progress,
                filename = filename ?: info.filename,
                errorMessage = errorMessage,
            )
            try {
                updateChannel.trySend(updated)
            } catch (e: Exception) {
                // Channel full or closed, ignore
            }
            updated
        }
    }

    /** Atomically transitions PENDING -> DOWNLOADING; returns false if not PENDING. */
    private fun tryStart(id: String): Boolean {
        var started = false
        downloads.computeIfPresent(id) { _, info ->
            if (info.status == DownloadStatus.PENDING) {
                started = true
                val updated = info.copy(
                    status = DownloadStatus.DOWNLOADING,
                    startedAt = Instant.now(),
                )
                try {
                    updateChannel.trySend(updated)
                } catch (e: Exception) {
                    // Channel full or closed, ignore
                }
                updated
            } else {
                info
            }
        }
        return started
    }

    /** Atomically transitions PENDING -> CANCELLED; returns false if not PENDING. */
    private fun tryCancelPending(id: String): Boolean {
        var cancelled = false
        downloads.computeIfPresent(id) { _, info ->
            if (info.status == DownloadStatus.PENDING) {
                cancelled = true
                val updated = info.copy(
                    status = DownloadStatus.CANCELLED,
                    completedAt = Instant.now(),
                )
                try {
                    updateChannel.trySend(updated)
                } catch (e: Exception) {
                    // Channel full or closed, ignore
                }
                updated
            } else {
                info
            }
        }
        return cancelled
    }

    /** Atomically transitions DOWNLOADING -> CANCELLED; returns false if not DOWNLOADING. */
    private fun tryCancelRunning(id: String): Boolean {
        var cancelled = false
        downloads.computeIfPresent(id) { _, info ->
            if (info.status == DownloadStatus.DOWNLOADING) {
                cancelled = true
                val updated = info.copy(
                    status = DownloadStatus.CANCELLED,
                    completedAt = Instant.now(),
                )
                try {
                    updateChannel.trySend(updated)
                } catch (e: Exception) {
                    // Channel full or closed, ignore
                }
                updated
            } else {
                info
            }
        }
        return cancelled
    }

    fun cancelDownload(id: String): Boolean {
        // First try to cancel a queued (PENDING) download.
        if (tryCancelPending(id)) return true
        // Then try to cancel a running process.
        activeProcesses.remove(id)?.let { process ->
            process.destroyForcibly()
            updateStatus(id, DownloadStatus.CANCELLED, completedAt = Instant.now())
            return true
        }
        // Finally try to cancel a DOWNLOADING download whose process was already
        // removed (edge race: process exit between our checks).
        if (tryCancelRunning(id)) return true
        return false
    }

    fun getConfig(): String = baseDirectory

    private fun extractFilename(output: String): String? {
        val patterns = listOf(
            """\[download\] Destination: (.+)""".toRegex(),
            """Merging formats into "(.+)"""".toRegex(),
            """\[ffmpeg\] Merging formats into "(.+)"""".toRegex(),
        )

        for (pattern in patterns) {
            val match = pattern.find(output)
            match?.groupValues?.get(1)?.let { return it }
        }

        val lines = output.lines().filter { it.contains("Destination:") || it.contains("Merging") }.toList()
        for (line in lines.reversed()) {
            val match = """[">]([^"<]+)\.[a-zA-Z0-9]+["<]?$""".toRegex().find(line)
            match?.groupValues?.get(1)?.let { return "$it.${line.substringAfterLast(".")}" }
        }

        return null
    }

    /**
     * Ensures the user-supplied output template contains an `%(ext)s` placeholder;
     * appends it when missing so free-text patterns still produce a file with an extension.
     */
    private fun normalizeOutputTemplate(pattern: String): String {
        val trimmed = pattern.trim()
        return if (trimmed.contains(EXT_PLACEHOLDER)) trimmed else "$trimmed.$EXT_PLACEHOLDER"
    }
}
