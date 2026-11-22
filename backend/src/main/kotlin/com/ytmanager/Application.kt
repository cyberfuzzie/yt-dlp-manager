package com.ytmanager

import com.ytmanager.model.DownloadInfo
import com.ytmanager.routing.apiRoutes
import com.ytmanager.service.DownloadService
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.callid.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.websocket.WebSockets
import io.ktor.server.netty.EngineMain
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch

internal const val WEBSOCKET_PING_PERIOD_MS = 20_000L

fun Application.module() {
    val config = environment.config
    val baseDirectory = System.getenv("APP_DOWNLOAD_BASE_DIRECTORY")
        ?: config.propertyOrNull("app.download.base-directory")?.getString()
        ?: "/downloads"

    val json = appJson()

    install(CallId)
    install(CallLogging)
    install(WebSockets) {
        // Ping idle connections so proxies do not close them after their read timeout.
        pingPeriodMillis = WEBSOCKET_PING_PERIOD_MS
    }
    install(ContentNegotiation) {
        json(json)
    }
    install(CORS) {
        anyHost()
        listOf(HttpMethod.Get, HttpMethod.Post, HttpMethod.Delete, HttpMethod.Options, HttpMethod.Head, HttpMethod.Put, HttpMethod.Patch).forEach { allowMethod(it) }
        listOf(HttpHeaders.ContentType, HttpHeaders.Authorization).forEach { allowHeader(it) }
    }
    
    val updateChannel = Channel<DownloadInfo>(Channel.UNLIMITED)
    val downloadService = DownloadService(baseDirectory, updateChannel)

    // A single consumer fans updates out to every connected WebSocket. A plain Channel
    // would deliver each update to only one session when clients reconnect or overlap.
    val updateFlow = MutableSharedFlow<DownloadInfo>(extraBufferCapacity = 256)
    launch {
        for (info in updateChannel) {
            updateFlow.emit(info)
        }
    }

    routing {
        apiRoutes(downloadService, updateFlow)
        
        get("/health") {
            call.respondText("OK", ContentType.Text.Plain)
        }
    }
}

fun main(args: Array<String>) {
    EngineMain.main(args)
}