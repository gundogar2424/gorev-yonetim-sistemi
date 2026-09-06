package com.otoara.app.call

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/**
 * Gorusme sesini hoparlore verir.
 *
 * Iki ayri yol denenir, cunku hangisinin isledigi cihaza/surume gore degisir:
 *  1. Android 12+ icin `setCommunicationDevice`,
 *  2. Eskiden beri var olan `isSpeakerphoneOn` (yeni surumlerde "deprecated"
 *     olmasina ragmen bircok cihazda hala tek isleyen yol budur).
 *
 * Sistem cagrilarinin ses yolu aslinda varsayilan telefon uygulamasinin
 * kontrolundedir; o, cagri baglandiginda ayari kendi tercihine geri
 * cekebiliyor. Bu yuzden [on] cagrisi tek seferlik degil, servis tarafindan
 * cagrinin ilk saniyelerinde tekrar tekrar uygulanir.
 */
object Speaker {

    /** Hoparloru acmayi dener; sonucta gercekten acik mi onu doner. */
    fun on(context: Context): Boolean {
        val am = context.getSystemService(AudioManager::class.java) ?: return false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val speaker = am.availableCommunicationDevices
                    .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                if (speaker != null) am.setCommunicationDevice(speaker)
            } catch (e: Exception) {
                // Sonraki yol denenir.
            }
            if (isOn(context)) return true
        }

        try {
            @Suppress("DEPRECATION")
            am.isSpeakerphoneOn = true
        } catch (e: Exception) {
            // yoksay
        }
        return isOn(context)
    }

    /** Ses yolunu telefonun kendi secimine birakir (kulaklik/ahize). */
    fun off(context: Context) {
        val am = context.getSystemService(AudioManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                am.clearCommunicationDevice()
            } catch (e: Exception) {
                // yoksay
            }
        }
        try {
            @Suppress("DEPRECATION")
            am.isSpeakerphoneOn = false
        } catch (e: Exception) {
            // yoksay
        }
    }

    fun isOn(context: Context): Boolean {
        val am = context.getSystemService(AudioManager::class.java) ?: return false
        return try {
            val modern = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                am.communicationDevice?.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
            @Suppress("DEPRECATION")
            modern || am.isSpeakerphoneOn
        } catch (e: Exception) {
            false
        }
    }
}
