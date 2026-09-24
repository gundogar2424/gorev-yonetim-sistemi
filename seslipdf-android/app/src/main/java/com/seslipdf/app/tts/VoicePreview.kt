package com.seslipdf.app.tts

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

/**
 * Ayarlar'da doğal sesi secerken kisa bir ornek cumle dinletir; kullanici
 * sesi duyarak secebilsin.
 */
object VoicePreview {

    /** Ornek cumle; tanitim kaydindakiyle ayni, secerken karsilastirilabilsin. */
    fun sampleText(voice: Int) =
        "${voice + 1} numaralı ses. Sabahları fırından yayılan ekmek kokusu, bütün sokağı sarardı."

    /**
     * Sesi uretir ve sonuna kadar calar. Iptal edilirse (baska ses secildi,
     * ekrandan cikildi) hemen susar. Basarisizsa false doner.
     */
    suspend fun play(context: Context, voice: Int, speed: Float): Boolean {
        val samples = NeuralVoice.generate(context, sampleText(voice), speed, voice)
            ?: return false
        val sampleRate = NeuralVoice.sampleRate(context)

        val track = try {
            AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(
                    maxOf(
                        AudioTrack.getMinBufferSize(
                            sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT
                        ),
                        sampleRate * 2
                    )
                )
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()
        } catch (e: Exception) {
            return false
        }

        try {
            track.play()
            var offset = 0
            while (offset < samples.size) {
                if (!currentCoroutineContext().isActive) return true
                val count = minOf(4096, samples.size - offset)
                val written = track.write(samples, offset, count, AudioTrack.WRITE_BLOCKING)
                if (written <= 0) break
                offset += written
            }
            // Tamponda kalan kisim da calinsin.
            while (currentCoroutineContext().isActive &&
                track.playbackHeadPosition < samples.size
            ) {
                delay(50)
            }
            return true
        } catch (e: Exception) {
            return false
        } finally {
            try { track.pause() } catch (e: Exception) { }
            try { track.flush() } catch (e: Exception) { }
            try { track.release() } catch (e: Exception) { }
        }
    }
}
