package com.ytmanager

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import java.time.Instant

/** Contextual serializer for [Instant], encoded as an ISO-8601 string. */
val instantSerializer: KSerializer<Instant> = object : KSerializer<Instant> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("Instant", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: Instant) {
        encoder.encodeString(value.toString())
    }

    override fun deserialize(decoder: Decoder): Instant = Instant.parse(decoder.decodeString())
}

/**
 * The single JSON configuration shared by the REST and WebSocket layers. It must be used
 * everywhere a [com.ytmanager.model.DownloadInfo] is (de)serialized, because its timestamps are
 * `@Contextual` and require the registered [instantSerializer].
 */
fun appJson(): Json = Json {
    prettyPrint = true
    ignoreUnknownKeys = true
    serializersModule = SerializersModule { contextual(Instant::class, instantSerializer) }
}
