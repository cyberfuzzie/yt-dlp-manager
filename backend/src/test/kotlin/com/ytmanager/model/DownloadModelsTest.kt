package com.ytmanager.model

import com.ytmanager.appJson
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DownloadModelsTest {
    private val json = appJson()

    @Test
    fun `download request round trips and applies defaults`() {
        val full = DownloadRequest(
            url = "https://example.com/v",
            targetDirectory = "sub",
            format = "mp4",
            quality = "720",
        )
        val encoded = json.encodeToString(DownloadRequest.serializer(), full)
        assertEquals(full, json.decodeFromString(DownloadRequest.serializer(), encoded))

        val defaults = DownloadRequest(url = "https://example.com/v")
        assertNull(defaults.targetDirectory)
        assertNull(defaults.format)
        assertNull(defaults.quality)
    }

    @Test
    fun `download info has sensible defaults`() {
        val info = DownloadInfo(url = "https://example.com/v", targetDirectory = null, format = null, quality = null)

        assertTrue(info.id.isNotBlank())
        assertEquals(DownloadStatus.PENDING, info.status)
        assertEquals(0.0, info.progress)
        assertNull(info.speed)
        assertNull(info.eta)
        assertNull(info.filename)
        assertNull(info.fileSize)
        assertNull(info.errorMessage)
        assertNotNull(info.createdAt)
        assertNull(info.startedAt)
        assertNull(info.completedAt)
    }

    @Test
    fun `download info ids are unique`() {
        val first = DownloadInfo(url = "u", targetDirectory = null, format = null, quality = null)
        val second = DownloadInfo(url = "u", targetDirectory = null, format = null, quality = null)
        assertNotEquals(first.id, second.id)
    }

    @Test
    fun `download info round trips with instants`() {
        val info = DownloadInfo(
            id = "abc",
            url = "https://example.com/v",
            targetDirectory = "sub",
            format = "mp4",
            quality = "720",
            status = DownloadStatus.DOWNLOADING,
            progress = 42.5,
            speed = "1.0MiB/s",
            eta = "00:10",
            filename = "video.mp4",
            fileSize = 1024L,
            errorMessage = "none",
            createdAt = Instant.parse("2026-01-01T00:00:00Z"),
            startedAt = Instant.parse("2026-01-01T00:00:01Z"),
            completedAt = Instant.parse("2026-01-01T00:00:02Z"),
        )
        val encoded = json.encodeToString(DownloadInfo.serializer(), info)
        assertEquals(info, json.decodeFromString(DownloadInfo.serializer(), encoded))
    }

    @Test
    fun `download status exposes the expected values`() {
        assertEquals(
            listOf("PENDING", "DOWNLOADING", "COMPLETED", "FAILED", "CANCELLED"),
            DownloadStatus.entries.map { it.name },
        )
        assertEquals(DownloadStatus.CANCELLED, DownloadStatus.valueOf("CANCELLED"))
    }

    @Test
    fun `simple response models round trip`() {
        val response = DownloadResponse(id = "id-1", message = "Download started")
        assertEquals(
            response,
            json.decodeFromString(DownloadResponse.serializer(), json.encodeToString(DownloadResponse.serializer(), response)),
        )

        val config = ConfigResponse(baseDirectory = "/downloads")
        assertEquals(
            config,
            json.decodeFromString(ConfigResponse.serializer(), json.encodeToString(ConfigResponse.serializer(), config)),
        )

        val info = DownloadInfo(url = "u", targetDirectory = null, format = null, quality = null)
        val message = WebSocketMessage(type = "download_update", payload = info)
        assertEquals(
            message,
            json.decodeFromString(WebSocketMessage.serializer(), json.encodeToString(WebSocketMessage.serializer(), message)),
        )

        val debug = DebugResponse(size = 1, downloads = listOf(info))
        assertEquals(
            debug,
            json.decodeFromString(DebugResponse.serializer(), json.encodeToString(DebugResponse.serializer(), debug)),
        )
    }
}
