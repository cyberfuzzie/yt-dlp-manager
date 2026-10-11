package com.ytmanager.model

import kotlinx.serialization.Contextual
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.CompositeDecoder
import kotlinx.serialization.encoding.CompositeEncoder
import kotlinx.serialization.json.Json
import java.time.Instant
import java.util.UUID

@Serializable
data class DownloadRequest(
    val url: String,
    val targetDirectory: String? = null,
    val format: String? = null,
    val quality: String? = null,
)

@Serializable
data class DownloadInfo(
    val id: String = UUID.randomUUID().toString(),
    val url: String,
    val targetDirectory: String?,
    val format: String?,
    val quality: String?,
    val status: DownloadStatus = DownloadStatus.PENDING,
    val progress: Double = 0.0,
    val speed: String? = null,
    val eta: String? = null,
    val filename: String? = null,
    val fileSize: Long? = null,
    val errorMessage: String? = null,
    @Contextual val createdAt: Instant = Instant.now(),
    @Contextual val startedAt: Instant? = null,
    @Contextual val completedAt: Instant? = null,
)

@Serializable
enum class DownloadStatus {
    PENDING,
    DOWNLOADING,
    COMPLETED,
    FAILED,
    CANCELLED,
}

@Serializable
data class DownloadResponse(
    val id: String,
    val message: String,
)

@Serializable
data class ConfigResponse(
    val baseDirectory: String,
)

@Serializable
data class WebSocketMessage(
    val type: String,
    val payload: DownloadInfo,
)

@Serializable
data class DebugResponse(
    val size: Int,
    val downloads: List<DownloadInfo>,
)