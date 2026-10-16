package com.ytmanager.service

import com.ytmanager.awaitStatus
import com.ytmanager.fakeYtDlp
import com.ytmanager.model.DownloadRequest
import com.ytmanager.model.DownloadStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
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
        val script = fakeYtDlp(tempDir, "sleep 3\nexit 0")
        val service = service(script)

        val dl1 = service.addDownload(DownloadRequest(url = "https://youtube.com/video1"))
        val dl2 = service.addDownload(DownloadRequest(url = "https://example.com/video1"))

        // Both should reach DOWNLOADING
        awaitStatus(service, dl1.id) { it == DownloadStatus.DOWNLOADING }
        awaitStatus(service, dl2.id) { it == DownloadStatus.DOWNLOADING }

        // Both must still be DOWNLOADING at the same instant — deadline shorter than sleep(3)
        // This proves they are running in parallel, not serialised.
        val deadline = System.currentTimeMillis() + 1_000
        var bothStillRunning = true
        while (System.currentTimeMillis() < deadline) {
            val s1 = service.getDownload(dl1.id)?.status
            val s2 = service.getDownload(dl2.id)?.status
            if (s1 != DownloadStatus.DOWNLOADING || s2 != DownloadStatus.DOWNLOADING) {
                bothStillRunning = false
                break
            }
            delay(50)
        }
        assertTrue(bothStillRunning, "both downloads must still be DOWNLOADING to prove concurrency")

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

    // ── e. Unparseable URLs run in parallel ─────────────────────────────────

    @Test
    fun `unparseable URLs do not block each other`() = runBlocking<Unit> {
        val logPath = tempDir.resolve("log.txt").absolutePath
        val script = fakeYtDlp(
            tempDir,
            "URL=\"\"\nfor A in \"\$@\"; do URL=\"\$A\"; done\necho \"start|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nsleep 3\nexit 0"
        )
        val service = service(script)

        // Each unparseable URL gets its own provider key, so they run in parallel
        val dl1 = service.addDownload(DownloadRequest(url = "not a url"))
        val dl2 = service.addDownload(DownloadRequest(url = "also not a url"))

        awaitStatus(service, dl1.id) { it == DownloadStatus.DOWNLOADING }
        awaitStatus(service, dl2.id) { it == DownloadStatus.DOWNLOADING }

        // Both must still be DOWNLOADING to prove parallel execution
        val deadline = System.currentTimeMillis() + 1_000
        var bothStillRunning = true
        while (System.currentTimeMillis() < deadline) {
            val s1 = service.getDownload(dl1.id)?.status
            val s2 = service.getDownload(dl2.id)?.status
            if (s1 != DownloadStatus.DOWNLOADING || s2 != DownloadStatus.DOWNLOADING) {
                bothStillRunning = false
                break
            }
            delay(50)
        }
        assertTrue(bothStillRunning, "both unparseable downloads must still be DOWNLOADING")

        awaitStatus(service, dl1.id) { it == DownloadStatus.COMPLETED }
        awaitStatus(service, dl2.id) { it == DownloadStatus.COMPLETED }
    }

    // ── f. Cancelling a RUNNING download stays CANCELLED ────────────────────

    @Test
    fun `cancelling a running download stays CANCELLED not FAILED`() = runBlocking<Unit> {
        val script = fakeYtDlp(tempDir, "sleep 5\nexit 1")
        val service = service(script)

        val dl = service.addDownload(DownloadRequest(url = "https://example.com/v"))
        awaitStatus(service, dl.id) { it == DownloadStatus.DOWNLOADING }
        delay(100)

        val cancelled = service.cancelDownload(dl.id)
        assertTrue(cancelled)

        // Status must stay CANCELLED and never flip to FAILED
        val info = awaitStatus(service, dl.id) { it == DownloadStatus.CANCELLED }
        assertEquals(DownloadStatus.CANCELLED, info.status)
    }

    // ── g. Atomic worker creation — regression test ─────────────────────────

    @Test
    fun `concurrent adds for the same provider never exceed one running at a time`() = runBlocking<Unit> {
        val logPath = tempDir.resolve("log.txt").absolutePath
        val script = fakeYtDlp(
            tempDir,
            "URL=\"\"\nfor A in \"\$@\"; do URL=\"\$A\"; done\necho \"start|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nsleep 0.5\necho \"end|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nexit 0"
        )
        val service = service(script)

        // Launch 6 concurrent adds from parallel coroutines
        coroutineScope {
            repeat(6) { i ->
                launch {
                    service.addDownload(
                        DownloadRequest(url = "https://youtube.com/video$i")
                    )
                }
            }
        }

        // Wait for all to complete
        for (i in 0 until 6) {
            val dl = service.getAllDownloads().find { it.url.contains("video$i") }!!
            assertNotNull(dl)
            awaitStatus(service, dl.id) { it == DownloadStatus.COMPLETED }
        }

        // Verify no overlapping intervals in the log
        val logFile = File(tempDir, "log.txt")
        assertTrue(logFile.exists(), "log file should exist")
        val lines = logFile.readLines()
        // Each download writes start + end = 2 lines; 6 downloads = 12 lines
        assertEquals(12, lines.size) { "expected 12 log entries for 6 downloads" }

        // Parse intervals: [start_ts1, end_ts1], [start_ts2, end_ts2], ...
        // Verify each end_ts <= next start_ts (no overlap)
        for (i in 0 until lines.size step 2) {
            val endTs = lines[i + 1].split("|")[1].toLong()
            if (i + 2 < lines.size) {
                val nextStartTs = lines[i + 2].split("|")[1].toLong()
                assertTrue(endTs <= nextStartTs, "download interval ${i / 2} must not overlap with next")
            }
        }
    }

    // ── h. Cancel between DOWNLOADING and process registration ──────────────

    @Test
    fun `cancelling a download right as it starts is handled correctly`() = runBlocking<Unit> {
        val logPath = tempDir.resolve("log.txt").absolutePath
        val script = fakeYtDlp(
            tempDir,
            "URL=\"\"\nfor A in \"\$@\"; do URL=\"\$A\"; done\necho \"start|\$(date +%s%N)|\$URL\" >> \"$logPath\"\nsleep 3\nexit 0"
        )
        val service = service(script)

        val dl = service.addDownload(DownloadRequest(url = "https://youtube.com/video1"))
        awaitStatus(service, dl.id) { it == DownloadStatus.DOWNLOADING }
        // Immediately try to cancel — may hit the race window after tryStart but before process registration
        val cancelled = service.cancelDownload(dl.id)
        if (cancelled) {
            // Successfully cancelled before process started
            val info = awaitStatus(service, dl.id) { it == DownloadStatus.CANCELLED }
            assertEquals(DownloadStatus.CANCELLED, info.status)
        } else {
            // Process already registered; retry until cancellation succeeds
            val deadline = System.currentTimeMillis() + 3_000
            var didCancel = false
            while (!didCancel && System.currentTimeMillis() < deadline) {
                didCancel = service.cancelDownload(dl.id)
                if (!didCancel) delay(20)
            }
            assertTrue(didCancel, "cancellation must eventually succeed")
            val info = awaitStatus(service, dl.id) { it == DownloadStatus.CANCELLED }
            assertEquals(DownloadStatus.CANCELLED, info.status)
        }
    }
}
