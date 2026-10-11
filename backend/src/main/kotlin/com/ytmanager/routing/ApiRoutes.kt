package com.ytmanager.routing

import com.ytmanager.model.DownloadInfo
import com.ytmanager.model.DownloadRequest
import com.ytmanager.model.DownloadResponse
import com.ytmanager.model.DebugResponse
import com.ytmanager.model.WebSocketMessage
import com.ytmanager.service.DownloadService
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.websocket.WebSockets
import io.ktor.server.request.receive
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.webSocket
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.consumeEach
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

fun Route.apiRoutes(downloadService: DownloadService) {
    route("/api") {
        get("/config") {
            call.respond(mapOf("baseDirectory" to downloadService.getConfig()))
        }
        
        get("/downloads") {
            call.respond(downloadService.getAllDownloads())
        }
        
        get("/debug/downloads") {
            val downloads = downloadService.getAllDownloads()
            call.respond(DebugResponse(downloads.size, downloads))
        }
        
        get("/downloads/{id}") {
            val id = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing id")
            downloadService.getDownload(id)?.let { call.respond(it) }
                ?: call.respond(HttpStatusCode.NotFound, "Download not found")
        }
        
        post("/downloads") {
            val request = call.receive<DownloadRequest>()
            if (request.url.isBlank()) {
                call.respond(HttpStatusCode.BadRequest, "URL is required")
                return@post
            }
            val download = downloadService.addDownload(request)
            call.respond(HttpStatusCode.Created, DownloadResponse(download.id, "Download started"))
        }
        
        delete("/downloads/{id}") {
            val id = call.parameters["id"] ?: return@delete call.respond(HttpStatusCode.BadRequest, "Missing id")
            val cancelled = downloadService.cancelDownload(id)
            if (cancelled) {
                call.respond(mapOf("message" to "Download cancelled"))
            } else {
                call.respond(HttpStatusCode.NotFound, "Download not found or not running")
            }
        }
        
        webSocket("/ws") {
            val json = Json { prettyPrint = true }
            
            val sendChannel = Channel<DownloadInfo>(Channel.UNLIMITED)
            
            // Send initial downloads
            val initialDownloads = downloadService.getAllDownloads()
            for (info in initialDownloads) {
                sendChannel.send(info)
            }
            
            coroutineScope {
                // Forward updates from service to WebSocket
                val updateJob = launch {
                    for (info in downloadService.updateChannel) {
                        sendChannel.trySend(info)
                    }
                }
                
                // Send messages to client
                val sendJob = launch {
                    for (info in sendChannel) {
                        val message = WebSocketMessage("download_update", info)
                        send(Frame.Text(json.encodeToString(WebSocketMessage.serializer(), message)))
                    }
                }
                
                // Handle incoming frames
                val receiveJob = launch {
                    incoming.consumeEach { frame ->
                        when (frame) {
                            is Frame.Text -> { /* Ignore */ }
                            is Frame.Binary -> { /* Ignore */ }
                            is Frame.Close -> {
                                terminate()
                            }
                            is Frame.Ping -> { /* Auto-pong */ }
                            is Frame.Pong -> { /* Ignore */ }
                        }
                    }
                }
                
                // Wait for receive job to complete (connection closed)
                receiveJob.join()
                
                // Cancel other jobs
                updateJob.cancel()
                sendJob.cancel()
                sendChannel.close()
            }
        }
    }
}