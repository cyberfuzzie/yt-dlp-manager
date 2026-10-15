package com.ytmanager.service

import com.ytmanager.awaitStatus
import com.ytmanager.fakeYtDlp
import com.ytmanager.model.DownloadRequest
import com.ytmanager.model.DownloadStatus
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

class ProviderThrottleTest {
    @TempDir
    lateinit var tempDir: File

    private fun service(executable: String = "missing-binary-xyz"): DownloadService =
        DownloadService(tempDir.absolutePath, Channel(Channel.UNLIMITED), executable)

    // ── a. Two downloads on the SAME provider run sequentially ──────────────

    @Test
    fun `two downloads on the same provider run sequentially without overlap`() = runBlocking<Unit> {
        val logPath = tempDir.resolve("log.txt").absolutePath
        val script = fakeYtDlp(
            tempDir,
            "URL=\"\"\nfor A in \"\$@\"; do URL=\"\$A\"; done\necho \"start|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nsleep 1\necho \"end|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nexit 0"
        )
        val service = service(script)

        val dl1 = service.addDownload(DownloadRequest(url = "https://youtube.com/video1"))
        val dl2 = service.addDownload(DownloadRequest(url = "https://youtube.com/video2"))

        // First one should be DOWNLOADING
        awaitStatus(service, dl1.id) { it == DownloadStatus.DOWNLOADING }

        // Second one should still be PENDING shortly after
        delay(200)
        assertEquals(DownloadStatus.PENDING, service.getDownload(dl2.id)?.status)

        // Wait for both to complete
        awaitStatus(service, dl1.id) { it == DownloadStatus.COMPLETED }
        awaitStatus(service, dl2.id) { it == DownloadStatus.COMPLETED }

        // Verify sequential execution: end of dl1 is before start of dl2
        val lines = File(tempDir, "log.txt").readLines()
        val end1 = lines[1].split("|")[1].toLong()
        val start2 = lines[2].split("|")[1].toLong()
        assertTrue(end1 < start2) { "downloads should not overlap" }
    }

    // ── b. Two downloads on DIFFERENT providers run concurrently ────────────

    @Test
    fun `downloads on different providers run concurrently`() = runBlocking<Unit> {
        val script = fakeYtDlp(tempDir, "sleep 2\nexit 0")
        val service = service(script)

        val dl1 = service.addDownload(DownloadRequest(url = "https://youtube.com/video1"))
        val dl2 = service.addDownload(DownloadRequest(url = "https://example.com/video1"))

        val dl1Info = awaitStatus(service, dl1.id) { it == DownloadStatus.DOWNLOADING }
        assertEquals(DownloadStatus.DOWNLOADING, dl1Info.status)

        val dl2Info = awaitStatus(service, dl2.id) { it == DownloadStatus.DOWNLOADING }
        assertEquals(DownloadStatus.DOWNLOADING, dl2Info.status)

        awaitStatus(service, dl1.id) { it == DownloadStatus.COMPLETED }
        awaitStatus(service, dl2.id) { it == DownloadStatus.COMPLETED }
    }

    // ── c. FIFO order ───────────────────────────────────────────────────────

    @Test
    fun `three same-provider downloads start in FIFO order`() = runBlocking<Unit> {
        val logPath = tempDir.resolve("log.txt").absolutePath
        val script = fakeYtDlp(
            tempDir,
            "URL=\"\"\nfor A in \"\$@\"; do URL=\"\$A\"; done\necho \"start|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nsleep 0.1\nexit 0"
        )
        val service = service(script)

        val dl1 = service.addDownload(DownloadRequest(url = "https://youtube.com/video1"))
        val dl2 = service.addDownload(DownloadRequest(url = "https://youtube.com/video2"))
        val dl3 = service.addDownload(DownloadRequest(url = "https://youtube.com/video3"))

        awaitStatus(service, dl1.id) { it == DownloadStatus.COMPLETED }
        awaitStatus(service, dl2.id) { it == DownloadStatus.COMPLETED }
        awaitStatus(service, dl3.id) { it == DownloadStatus.COMPLETED }

        val lines = File(tempDir, "log.txt").readLines()
        assertTrue(lines[0].endsWith("youtube.com/video1"))
        assertTrue(lines[1].endsWith("youtube.com/video2"))
        assertTrue(lines[2].endsWith("youtube.com/video3"))
    }

    // ── d. Cancelling a QUEUED download ─────────────────────────────────────

    @Test
    fun `cancelling a queued download works correctly`() = runBlocking<Unit> {
        val logPath = tempDir.resolve("log.txt").absolutePath
        // Loop to get last arg (POSIX-compatible)
        val script = fakeYtDlp(
            tempDir,
            "URL=\"\"\nfor A in \"\$@\"; do URL=\"\$A\"; done\necho \"start|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nsleep 3\nexit 0"
        )
        val service = service(script)

        val dl1 = service.addDownload(DownloadRequest(url = "https://youtube.com/video1"))
        awaitStatus(service, dl1.id) { it == DownloadStatus.DOWNLOADING }
        // Give the worker time to create and start the process
        delay(100)

        val dl2 = service.addDownload(DownloadRequest(url = "https://youtube.com/video2"))
        assertEquals(DownloadStatus.PENDING, service.getDownload(dl2.id)?.status)

        val cancelled = service.cancelDownload(dl2.id)
        assertTrue(cancelled)
        assertEquals(DownloadStatus.CANCELLED, service.getDownload(dl2.id)?.status)

        // dl2 should never start (no log entry)
        // Wait for the log file to be written by dl1's process
        val logFile = File(tempDir, "log.txt")
        val logDeadline = System.currentTimeMillis() + 5_000
        while (!logFile.exists() && System.currentTimeMillis() < logDeadline) {
            delay(20)
        }
        assertTrue(logFile.exists(), "log file should exist after dl1 started")
        val lines = logFile.readLines()
        assertFalse(lines.any { it.contains("video2") })

        awaitStatus(service, dl1.id) { it == DownloadStatus.COMPLETED }

        // A further queued download for the same provider should still run
        val dl3 = service.addDownload(DownloadRequest(url = "https://youtube.com/video3"))
        awaitStatus(service, dl3.id) { it == DownloadStatus.DOWNLOADING }
        awaitStatus(service, dl3.id) { it == DownloadStatus.COMPLETED }
    }

    // ── e. www. normalization ───────────────────────────────────────────────

    @Test
    fun `providerKey normalizes www prefix`() {
        assertEquals("youtube.com", DownloadService.providerKey("https://www.youtube.com/v"))
        assertEquals("youtube.com", DownloadService.providerKey("https://youtube.com/v"))
        assertEquals("example.com", DownloadService.providerKey("https://www.example.com/a"))
        assertEquals("example.com", DownloadService.providerKey("https://example.com/b"))
    }

    @Test
    fun `providerKey falls back to trimmed URL for URIs without host`() {
        assertEquals("file:///tmp/test", DownloadService.providerKey("file:///tmp/test"))
        assertEquals("not a valid url", DownloadService.providerKey("not a valid url"))
    }

    @Test
    fun `www normalization groups same provider downloads sequentially`() = runBlocking<Unit> {
        val logPath = tempDir.resolve("log.txt").absolutePath
        val script = fakeYtDlp(
            tempDir,
            "URL=\"\"\nfor A in \"\$@\"; do URL=\"\$A\"; done\necho \"start|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nsleep 1\nexit 0"
        )
        val service = service(script)

        // www.youtube.com and youtube.com share the same provider key
        val dl1 = service.addDownload(DownloadRequest(url = "https://www.youtube.com/video1"))
        val dl2 = service.addDownload(DownloadRequest(url = "https://youtube.com/video2"))

        awaitStatus(service, dl1.id) { it == DownloadStatus.DOWNLOADING }
        delay(200)
        assertEquals(DownloadStatus.PENDING, service.getDownload(dl2.id)?.status)

        awaitStatus(service, dl1.id) { it == DownloadStatus.COMPLETED }
        awaitStatus(service, dl2.id) { it == DownloadStatus.COMPLETED }

        val lines = File(tempDir, "log.txt").readLines()
        val start1 = lines[0].split("|")[1].toLong()
        val start2 = lines[1].split("|")[1].toLong()
        assertTrue(start1 < start2)
    }

    @Test
    fun `unparseable URLs do not block each other`() = runBlocking<Unit> {
        val script = fakeYtDlp(tempDir, "exit 0")
        val service = service(script)

        // Each unparseable URL gets its own provider key, so they run in parallel
        val dl1 = service.addDownload(DownloadRequest(url = "not a url"))
        val dl2 = service.addDownload(DownloadRequest(url = "also not a url"))

        awaitStatus(service, dl1.id) { it == DownloadStatus.COMPLETED }
        awaitStatus(service, dl2.id) { it == DownloadStatus.COMPLETED }
    }

    // ── f. Cancelling a RUNNING download stays CANCELLED ────────────────────

    @Test
    fun `cancelling a running download stays CANCELLED not FAILED`() = runBlocking<Unit> {
        // Use a script that exits with non-zero code so the terminal guard
        // is exercised: without it, the status would flip from CANCELLED to FAILED.
        val script = fakeYtDlp(tempDir, "sleep 5\nexit 1")
        val service = service(script)

        val dl = service.addDownload(DownloadRequest(url = "https://example.com/v"))
        awaitStatus(service, dl.id) { it == DownloadStatus.DOWNLOADING }

        var cancelled = false
        val deadline = System.currentTimeMillis() + 5_000
        while (!cancelled && System.currentTimeMillis() < deadline) {
            cancelled = service.cancelDownload(dl.id)
            if (!cancelled) delay(20)
        }
        assertTrue(cancelled, "expected the running process to be cancelled")

        // Status must stay CANCELLED and never flip to FAILED
        val info = awaitStatus(service, dl.id) { it == DownloadStatus.CANCELLED }
        assertEquals(DownloadStatus.CANCELLED, info.status)
    }
}
