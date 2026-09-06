package com.otoara.app.call

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/**
 * Gorusme sesini hoparlore verir. Android 12 (S) ve ustunde
 * `setCommunicationDevice`, daha eskilerde `isSpeakerphoneOn` kullanilir.
 *
 * Not: Sistem cagrilarinin ses yolunu degistirmek varsayilan telefon
 * uygulamasinin isidir; bazi cihaz/surumlerde ucuncu bir uygulamanin bunu
 * yapmasina izin verilmeyebilir. Bu yuzden her fonksiyon basarili olup
 * olmadigini doner.
 */
object Speaker {

    fun on(context: Context): Boolean {
        val am = context.getSystemService(AudioManager::class.java) ?: return false
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val speaker = am.availableCommunicationDevices
                    .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                speaker != null && am.setCommunicationDevice(speaker)
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = true
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn
            }
        } catch (e: Exception) {
            false
        }
    }

    /** Ses yolunu telefonun kendi secimine birakir (kulaklik/ahize). */
    fun off(context: Context) {
        val am = context.getSystemService(AudioManager::class.java) ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.clearCommunicationDevice()
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = false
            }
        } catch (e: Exception) {
            // yoksay
        }
    }

    fun isOn(context: Context): Boolean {
        val am = context.getSystemService(AudioManager::class.java) ?: return false
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.communicationDevice?.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn
            }
        } catch (e: Exception) {
            false
        }
    }
}
