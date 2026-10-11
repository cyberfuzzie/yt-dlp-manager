package com.ytmanager

import com.ytmanager.model.DownloadInfo
import com.ytmanager.model.DownloadStatus
import com.ytmanager.service.DownloadService
import kotlinx.coroutines.delay
import java.io.File
import kotlin.test.fail

/**
 * Writes an executable `yt-dlp` stub with [body] as its shell script and returns its absolute
 * path, so service tests can drive the real download pipeline without the real binary.
 */
fun fakeYtDlp(directory: File, body: String): String {
    val script = File(directory, "yt-dlp")
    script.writeText("#!/bin/sh\n$body\n")
    script.setExecutable(true)
    return script.absolutePath
}

/** Polls the service until the download reaches a status matching [predicate]. */
suspend fun awaitStatus(
    service: DownloadService,
    id: String,
    timeoutMs: Long = 15_000,
    predicate: (DownloadStatus) -> Boolean,
): DownloadInfo {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (System.currentTimeMillis() < deadline) {
        service.getDownload(id)?.let { if (predicate(it.status)) return it }
        delay(25)
    }
    fail("Timed out waiting for download $id; last status=${service.getDownload(id)?.status}")
}
