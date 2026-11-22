package com.ytmanager

import io.ktor.client.plugins.websocket.WebSockets as ClientWebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.plugin
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
import io.ktor.server.websocket.WebSockets
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ApplicationTest {
    private fun appConfig() =
        MapApplicationConfig("app.download.base-directory" to "/tmp/yt-dlp-manager-test")

    @Test
    fun `module serves the health endpoint and exposes the config`() = testApplication {
        environment { config = appConfig() }
        application { module() }

        val health = client.get("/health")
        assertEquals(HttpStatusCode.OK, health.status)
        assertEquals("OK", health.bodyAsText())

        val configResponse = client.get("/api/config")
        assertEquals(HttpStatusCode.OK, configResponse.status)
        assertTrue(configResponse.bodyAsText().contains("/tmp/yt-dlp-manager-test"))
    }

    @Test
    fun `module configures a websocket keepalive ping`() = testApplication {
        environment { config = appConfig() }
        application {
            module()
            // Must stay well below nginx's idle timeout to keep connections alive.
            assertEquals(20_000L, plugin(WebSockets).pingIntervalMillis)
        }
    }

    @Test
    fun `module broadcasts download updates to every websocket client`() = testApplication {
        environment { config = appConfig() }
        application { module() }

        // One download before connecting gives each socket an initial snapshot frame,
        // which confirms that its server-side update subscription is already active.
        val initial = client.post("/api/downloads") {
            contentType(ContentType.Application.Json)
            setBody("""{"url":"https://initial.test/v"}""")
        }
        assertEquals(HttpStatusCode.Created, initial.status)

        val firstSnapshot = CompletableDeferred<String>()
        val secondSnapshot = CompletableDeferred<String>()
        val firstUpdate = CompletableDeferred<String>()
        val secondUpdate = CompletableDeferred<String>()
        val firstClient = createClient { install(ClientWebSockets) }
        val secondClient = createClient { install(ClientWebSockets) }

        coroutineScope {
            launch {
                firstClient.webSocket("/api/ws") {
                    firstSnapshot.complete((withTimeout(5_000) { incoming.receive() } as Frame.Text).readText())
                    secondSnapshot.await()
                    client.post("/api/downloads") {
                        contentType(ContentType.Application.Json)
                        setBody("""{"url":"https://second.test/v"}""")
                    }
                    firstUpdate.complete((withTimeout(5_000) { incoming.receive() } as Frame.Text).readText())
                    close(CloseReason(CloseReason.Codes.NORMAL, "done"))
                }
            }
            launch {
                secondClient.webSocket("/api/ws") {
                    secondSnapshot.complete((withTimeout(5_000) { incoming.receive() } as Frame.Text).readText())
                    firstSnapshot.await()
                    secondUpdate.complete((withTimeout(5_000) { incoming.receive() } as Frame.Text).readText())
                    close(CloseReason(CloseReason.Codes.NORMAL, "done"))
                }
            }
        }

        assertTrue(withTimeout(5_000) { firstSnapshot.await() }.contains("initial.test"))
        assertTrue(withTimeout(5_000) { secondSnapshot.await() }.contains("initial.test"))
        assertEquals(
            withTimeout(5_000) { firstUpdate.await() },
            withTimeout(5_000) { secondUpdate.await() },
        )
    }

    @Test
    fun `module serializes download info including its instants`() = testApplication {
        environment { config = appConfig() }
        application { module() }

        val created = client.post("/api/downloads") {
            contentType(ContentType.Application.Json)
            setBody("""{"url":"https://example.com/v"}""")
        }
        assertEquals(HttpStatusCode.Created, created.status)
        val id = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"").find(created.bodyAsText())?.groupValues?.get(1)
        assertNotNull(id)

        val fetched = client.get("/api/downloads/$id")
        assertEquals(HttpStatusCode.OK, fetched.status)
        // createdAt is serialized through the contextual Instant serializer installed by module().
        assertTrue(fetched.bodyAsText().contains("createdAt"))
    }
}
