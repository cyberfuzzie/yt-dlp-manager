package com.ytmanager.routing

import com.ytmanager.appJson
import com.ytmanager.fakeYtDlp
import com.ytmanager.model.DownloadRequest
import com.ytmanager.model.DownloadStatus
import com.ytmanager.service.DownloadService
import io.ktor.client.plugins.websocket.WebSockets as ClientWebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.ktor.server.websocket.WebSockets as ServerWebSockets
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.send
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ApiRoutesTest {
    @TempDir
    lateinit var tempDir: File

    private fun newService(executable: String = "missing-binary-xyz"): DownloadService =
        DownloadService(tempDir.absolutePath, Channel(Channel.UNLIMITED), executable)

    private fun ApplicationTestBuilder.installRoutes(service: DownloadService) {
        install(ServerWebSockets)
        install(ContentNegotiation) { json(appJson()) }
        routing { apiRoutes(service) }
    }

    private suspend fun ApplicationTestBuilder.createDownload(url: String = "https://example.com/v"): String {
        val response = client.post("/api/downloads") {
            contentType(ContentType.Application.Json)
            setBody("""{"url":"$url"}""")
        }
        assertEquals(HttpStatusCode.Created, response.status)
        val id = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"").find(response.bodyAsText())?.groupValues?.get(1)
        assertNotNull(id)
        return id
    }

    @Test
    fun `config endpoint returns the base directory`() = testApplication {
        installRoutes(newService())

        val response = client.get("/api/config")
        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains(tempDir.absolutePath))
    }

    @Test
    fun `downloads endpoint starts empty`() = testApplication {
        installRoutes(newService())

        val response = client.get("/api/downloads")
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("[]", response.bodyAsText().trim())
    }

    @Test
    fun `debug endpoint reports the download count`() = testApplication {
        installRoutes(newService())

        val response = client.get("/api/debug/downloads")
        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("\"size\""))
    }

    @Test
    fun `posting a download creates it`() = testApplication {
        installRoutes(newService())

        val response = client.post("/api/downloads") {
            contentType(ContentType.Application.Json)
            setBody("""{"url":"https://example.com/v"}""")
        }
        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("Download started"))
    }

    @Test
    fun `posting a blank url is rejected`() = testApplication {
        installRoutes(newService())

        val response = client.post("/api/downloads") {
            contentType(ContentType.Application.Json)
            setBody("""{"url":""}""")
        }
        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test
    fun `a download can be fetched by id and unknown ids are 404`() = testApplication {
        installRoutes(newService())

        val id = createDownload()

        val found = client.get("/api/downloads/$id")
        assertEquals(HttpStatusCode.OK, found.status)
        assertTrue(found.bodyAsText().contains(id))

        val missing = client.get("/api/downloads/does-not-exist")
        assertEquals(HttpStatusCode.NotFound, missing.status)
    }

    @Test
    fun `deleting an unknown download is 404`() = testApplication {
        installRoutes(newService())

        val response = client.delete("/api/downloads/does-not-exist")
        assertEquals(HttpStatusCode.NotFound, response.status)
    }

    @Test
    fun `deleting a running download cancels it`() = testApplication {
        val script = fakeYtDlp(tempDir, "sleep 30\nexit 0")
        installRoutes(newService(script))

        val id = createDownload()

        var status: Int? = null
        val deadline = System.currentTimeMillis() + 10_000
        while (status != HttpStatusCode.OK.value && System.currentTimeMillis() < deadline) {
            status = client.delete("/api/downloads/$id").status.value
            if (status != HttpStatusCode.OK.value) delay(20)
        }
        assertEquals(HttpStatusCode.OK.value, status)
    }

    @Test
    fun `websocket streams downloads and consumes client frames`() = testApplication {
        val script = fakeYtDlp(tempDir, "echo '[download] Destination: out.mp4'\nexit 0")
        installRoutes(newService(script))
        createDownload()

        val wsClient = createClient { install(ClientWebSockets) }
        wsClient.webSocket("/api/ws") {
            val first = withTimeout(5_000) { incoming.receive() }
            assertTrue(first is Frame.Text, "expected an initial download update")

            send(Frame.Text("hello"))
            send(Frame.Binary(true, byteArrayOf(1)))
            send(Frame.Ping(byteArrayOf(2)))
            send(Frame.Pong(byteArrayOf(3)))
            delay(100)

            close(CloseReason(CloseReason.Codes.NORMAL, "done"))
        }
    }
}
