package com.ytmanager

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

fun Application.module() {
    val config = environment.config
    val baseDirectory = System.getenv("APP_DOWNLOAD_BASE_DIRECTORY")
        ?: config.propertyOrNull("app.download.base-directory")?.getString()
        ?: "/downloads"

    val json = appJson()

    install(CallId)
    install(CallLogging)
    install(WebSockets)
    install(ContentNegotiation) {
        json(json)
    }
    install(CORS) {
        anyHost()
        listOf(HttpMethod.Get, HttpMethod.Post, HttpMethod.Delete, HttpMethod.Options, HttpMethod.Head, HttpMethod.Put, HttpMethod.Patch).forEach { allowMethod(it) }
        listOf(HttpHeaders.ContentType, HttpHeaders.Authorization).forEach { allowHeader(it) }
    }
    
    val updateChannel = Channel<com.ytmanager.model.DownloadInfo>(Channel.UNLIMITED)
    val downloadService = DownloadService(baseDirectory, updateChannel)
    
    routing {
        apiRoutes(downloadService)
        
        get("/health") {
            call.respondText("OK", ContentType.Text.Plain)
        }
    }
}

fun main(args: Array<String>) {
    EngineMain.main(args)
}