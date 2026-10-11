package com.ytmanager.service

import com.ytmanager.awaitStatus
import com.ytmanager.fakeYtDlp
import com.ytmanager.model.DownloadRequest
import com.ytmanager.model.DownloadStatus
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DownloadServiceTest {
    @TempDir
    lateinit var tempDir: File

    private fun service(executable: String = "this-binary-does-not-exist-xyz"): DownloadService =
        DownloadService(tempDir.absolutePath, Channel(Channel.UNLIMITED), executable)

    @Test
    fun `getConfig returns the base directory`() {
        assertEquals(tempDir.absolutePath, service().getConfig())
    }

    @Test
    fun `downloads list starts empty and unknown ids are null`() {
        val service = service()
        assertTrue(service.getAllDownloads().isEmpty())
        assertNull(service.getDownload("missing"))
    }

    @Test
    fun `addDownload stores the request fields and emits an initial update`() = runBlocking {
        val service = service()
        val download = service.addDownload(
            DownloadRequest("https://example.com/v", "sub", "mp4", "720"),
        )

        assertEquals("https://example.com/v", download.url)
        assertEquals("sub", download.targetDirectory)
        assertEquals("mp4", download.format)
        assertEquals("720", download.quality)
        assertEquals(DownloadStatus.PENDING, download.status)
        assertEquals(download.id, service.getDownload(download.id)?.id)
        assertEquals(download.id, service.updateChannel.receive().id)
    }

    @Test
    fun `downloads are sorted newest first`() = runBlocking {
        val service = service()
        val first = service.addDownload(DownloadRequest(url = "https://example.com/1"))
        delay(10)
        val second = service.addDownload(DownloadRequest(url = "https://example.com/2"))

        assertEquals(listOf(second.id, first.id), service.getAllDownloads().map { it.id })
    }

    @Test
    fun `a missing yt-dlp binary marks the download as failed`() = runBlocking<Unit> {
        val service = service()
        val download = service.addDownload(DownloadRequest(url = "https://example.com/v"))

        val failed = awaitStatus(service, download.id) { it == DownloadStatus.FAILED }
        assertNotNull(failed.errorMessage)
        assertNotNull(failed.completedAt)
    }

    @Test
    fun `a successful run is parsed and completed`() = runBlocking<Unit> {
        val script = fakeYtDlp(
            tempDir,
            """
            echo 'download: 10.0%|1.0MiB/s|00:30'
            echo '[download]  50.0% of 10MiB at 1.5K/s ETA 00:05'
            echo 'unrelated noise'
            echo 'download: abc%|1.0MiB/s|00:30'
            echo 'download: too-short'
            echo '[download] Destination: ${tempDir.absolutePath}/video.mp4'
            exit 0
            """.trimIndent(),
        )
        val service = service(script)
        val download = service.addDownload(DownloadRequest(url = "https://example.com/v"))

        val completed = awaitStatus(service, download.id) { it == DownloadStatus.COMPLETED }
        assertEquals("${tempDir.absolutePath}/video.mp4", completed.filename)
        assertEquals(100.0, completed.progress)
        assertNotNull(completed.startedAt)
        assertNotNull(completed.completedAt)
    }

    @Test
    fun `a failing run is reported as failed with the output`() = runBlocking {
        val script = fakeYtDlp(tempDir, "echo 'ERROR: something went wrong'\nexit 3")
        val service = service(script)
        val download = service.addDownload(DownloadRequest(url = "https://example.com/v"))

        val failed = awaitStatus(service, download.id) { it == DownloadStatus.FAILED }
        assertEquals("yt-dlp exited with code 3: ERROR: something went wrong\n", failed.errorMessage)
    }

    @Test
    fun `format quality and a relative target directory are applied`() = runBlocking {
        val script = fakeYtDlp(tempDir, "echo '[download] Destination: out.mp4'\nexit 0")
        val service = service(script)
        val download = service.addDownload(
            DownloadRequest("https://example.com/v", "sub", "mp4", "720"),
        )

        awaitStatus(service, download.id) { it == DownloadStatus.COMPLETED }
        assertTrue(File(tempDir, "sub").isDirectory)
    }

    @Test
    fun `a blank target directory falls back to the base directory`() = runBlocking {
        val script = fakeYtDlp(tempDir, "exit 0")
        val service = service(script)
        val download = service.addDownload(DownloadRequest("https://example.com/v", "   "))

        val completed = awaitStatus(service, download.id) { it == DownloadStatus.COMPLETED }
        // No "Destination:" line was printed, so the filename falls back to "unknown".
        assertEquals("unknown", completed.filename)
    }

    @Test
    fun `cancelDownload returns false for an unknown download`() {
        assertFalse(service().cancelDownload("missing"))
    }

    @Test
    fun `cancelDownload stops a running download`() = runBlocking {
        val script = fakeYtDlp(tempDir, "sleep 30\nexit 0")
        val service = service(script)
        val download = service.addDownload(DownloadRequest(url = "https://example.com/v"))

        awaitStatus(service, download.id) { it == DownloadStatus.DOWNLOADING }

        var cancelled = false
        val deadline = System.currentTimeMillis() + 10_000
        while (!cancelled && System.currentTimeMillis() < deadline) {
            cancelled = service.cancelDownload(download.id)
            if (!cancelled) delay(20)
        }
        assertTrue(cancelled, "expected the running process to be cancelled")
    }
}
