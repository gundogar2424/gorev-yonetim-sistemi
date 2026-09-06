package com.seslipdf.app.tts

import android.content.Context
import android.speech.tts.TextToSpeech
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import kotlin.coroutines.resume

/** Ayarlar ekraninda listelenen bir ses. */
data class VoiceInfo(
    /** TextToSpeech.Voice.name — ayarlarda bu saklanir. */
    val name: String,
    val localeTag: String,
    val localeLabel: String,
    /** Internet gerektiren (bulut) ses mi. */
    val networkOnly: Boolean
) {
    /** "Türkçe · ses 3" gibi okunakli ad. */
    val label: String
        get() {
            val short = name.substringAfterLast('-').replace('_', ' ').trim()
            return if (short.isBlank()) localeLabel else "$localeLabel · $short"
        }
}

/**
 * Cihazda kurulu metin okuma seslerini listeler. Bunun icin gecici bir TTS
 * motoru acilir, liste alinir ve motor hemen kapatilir.
 */
object VoiceCatalog {

    suspend fun load(context: Context): List<VoiceInfo> = withContext(Dispatchers.IO) {
        withTimeoutOrNull(8_000) { loadInternal(context) } ?: emptyList()
    }

    private suspend fun loadInternal(context: Context): List<VoiceInfo> =
        suspendCancellableCoroutine { cont ->
            var engine: TextToSpeech? = null
            engine = TextToSpeech(context.applicationContext) { status ->
                val list = if (status == TextToSpeech.SUCCESS) {
                    try {
                        engine?.voices.orEmpty()
                            .map { voice ->
                                VoiceInfo(
                                    name = voice.name,
                                    localeTag = voice.locale.toLanguageTag(),
                                    localeLabel = voice.locale.getDisplayName(Locale("tr")),
                                    networkOnly = voice.isNetworkConnectionRequired
                                )
                            }
                            .sortedWith(
                                compareByDescending<VoiceInfo> { it.localeTag.startsWith("tr") }
                                    .thenBy { it.localeLabel }
                                    .thenBy { it.name }
                            )
                    } catch (e: Exception) {
                        emptyList()
                    }
                } else {
                    emptyList()
                }
                try { engine?.shutdown() } catch (e: Exception) { }
                if (cont.isActive) cont.resume(list)
            }
            cont.invokeOnCancellation {
                try { engine?.shutdown() } catch (e: Exception) { }
            }
        }
}
