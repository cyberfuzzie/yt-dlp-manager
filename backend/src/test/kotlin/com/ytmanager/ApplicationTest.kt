package com.ytmanager

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
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
