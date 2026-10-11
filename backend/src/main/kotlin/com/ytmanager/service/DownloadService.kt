package com.ytmanager.service

import com.ytmanager.model.DownloadInfo
import com.ytmanager.model.DownloadRequest
import com.ytmanager.model.DownloadStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.json.Json
import java.io.File
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class DownloadService(
    private val baseDirectory: String,
    val updateChannel: Channel<DownloadInfo>,
) {
    private val downloads = ConcurrentHashMap<String, DownloadInfo>()
    private val mutex = Mutex()
    private val activeProcesses = ConcurrentHashMap<String, Process>()

    fun getAllDownloads(): List<DownloadInfo> {
        return downloads.values.toList().sortedByDescending { it.createdAt }
    }

    fun getDownload(id: String): DownloadInfo? {
        return downloads[id]
    }

    suspend fun addDownload(request: DownloadRequest): DownloadInfo {
        val download = DownloadInfo(
            url = request.url,
            targetDirectory = request.targetDirectory,
            format = request.format,
            quality = request.quality,
        )
        
        downloads[download.id] = download
        updateChannel.send(download.copy())
        
        CoroutineScope(Dispatchers.IO).launch {
            executeDownload(download)
        }
        
        return download
    }

    private suspend fun executeDownload(download: DownloadInfo) {
        val processMutex = Mutex()
        
        try {
            updateStatus(download.id, DownloadStatus.DOWNLOADING, startedAt = Instant.now())
            
            val targetDir = resolveTargetDirectory(download.targetDirectory)
            targetDir.mkdirs()
            
            val command = buildYtDlpCommand(download, targetDir)
            
            val process = ProcessBuilder(*command.toTypedArray())
                .directory(targetDir)
                .redirectErrorStream(true)
                .start()
            
            processMutex.lock()
            try {
                activeProcesses[download.id] = process
            } finally {
                processMutex.unlock()
            }
            
            val output = StringBuilder()
            val inputStream = process.inputStream.bufferedReader()
            
            while (true) {
                val line = inputStream.readLine() ?: break
                output.append(line).append("\n")
                parseProgress(line, download.id)
            }
            
            val exitCode = process.waitFor()
            
            processMutex.lock()
            try {
                activeProcesses.remove(download.id)
            } finally {
                processMutex.unlock()
            }
            
            if (exitCode == 0) {
                val filename = extractFilename(output.toString()) ?: "unknown"
                updateStatus(
                    download.id,
                    DownloadStatus.COMPLETED,
                    filename = filename,
                    completedAt = Instant.now(),
                    progress = 100.0
                )
            } else {
                updateStatus(
                    download.id,
                    DownloadStatus.FAILED,
                    errorMessage = "yt-dlp exited with code $exitCode: ${output.takeLast(500)}",
                    completedAt = Instant.now()
                )
            }
        } catch (e: Exception) {
            processMutex.lock()
            try {
                activeProcesses.remove(download.id)
            } finally {
                processMutex.unlock()
            }
            updateStatus(
                download.id,
                DownloadStatus.FAILED,
                errorMessage = e.message ?: "Unknown error",
                completedAt = Instant.now()
            )
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
        val command = mutableListOf<String>("yt-dlp")
        
        command.add("--no-playlist")
        command.add("--restrict-filenames")
        command.add("--output")
        command.add("%(title)s [%(id)s].%(ext)s")
        
        download.format?.let { command.add("--format"); command.add(it) }
        download.quality?.let { command.add("--format"); command.add("bestvideo[height<=${it}]+bestaudio/best[height<=${it}]") }
        
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
                    etaMatch?.groupValues?.get(1)
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
                // Channel full, ignore
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
                // Channel full, ignore
            }
            updated
        }
    }

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

    fun cancelDownload(id: String): Boolean {
        return activeProcesses.remove(id)?.let { process ->
            process.destroyForcibly()
            updateStatus(id, DownloadStatus.CANCELLED, completedAt = Instant.now())
            true
        } ?: false
    }

    fun getConfig(): String = baseDirectory
}