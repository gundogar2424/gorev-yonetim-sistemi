package com.otoara.app.data

import android.content.Context

/**
 * Ekrandaki ayarlar (hedef numara, aralik, tekrar sayisi, sure...) telefonda
 * saklanir; uygulama kapanip acilinca ayni degerlerle gelir.
 */
class Prefs(context: Context) {

    private val sp = context.applicationContext
        .getSharedPreferences("otoara", Context.MODE_PRIVATE)

    var number: String
        get() = sp.getString("number", "") ?: ""
        set(v) = sp.edit().putString("number", v).apply()

    var extension: String
        get() = sp.getString("ext", "") ?: ""
        set(v) = sp.edit().putString("ext", v).apply()

    var extensionOn: Boolean
        get() = sp.getBoolean("extOn", false)
        set(v) = sp.edit().putBoolean("extOn", v).apply()

    /** Iki arama arasindaki bekleme (saniye). */
    var intervalSec: Int
        get() = sp.getInt("interval", 30)
        set(v) = sp.edit().putInt("interval", v).apply()

    /** Toplam kac kez aranacak. */
    var repeats: Int
        get() = sp.getInt("repeats", 10)
        set(v) = sp.edit().putInt("repeats", v).apply()

    /** Her aramanin en fazla ne kadar suresi var (saniye) — dolunca kapatilir. */
    var ringSec: Int
        get() = sp.getInt("ring", 30)
        set(v) = sp.edit().putInt("ring", v).apply()

    /** Cagri cevaplandiysa donguyu bitir. */
    var stopWhenAnswered: Boolean
        get() = sp.getBoolean("stopAnswered", true)
        set(v) = sp.edit().putBoolean("stopAnswered", v).apply()

    /** Sure dolunca cagriyi uygulama kapatsin mi. */
    var hangUpOnTimeout: Boolean
        get() = sp.getBoolean("hangup", true)
        set(v) = sp.edit().putBoolean("hangup", v).apply()

    fun toConfig() = RedialConfig(
        number = number,
        extension = if (extensionOn) extension else "",
        intervalSec = intervalSec,
        repeats = repeats,
        ringSec = ringSec,
        stopWhenAnswered = stopWhenAnswered,
        hangUpOnTimeout = hangUpOnTimeout
    )
}

/** Bir tekrar-arama turunun tum ayarlari. */
data class RedialConfig(
    val number: String,
    val extension: String,
    val intervalSec: Int,
    val repeats: Int,
    val ringSec: Int,
    val stopWhenAnswered: Boolean,
    val hangUpOnTimeout: Boolean
) {
    companion object {
        /** Sebekeyi bogmamak icin en kisa bekleme. */
        const val MIN_INTERVAL = 5
        const val MAX_INTERVAL = 3600
        const val MIN_RING = 5
        const val MAX_RING = 600
        const val MIN_REPEATS = 1
        const val MAX_REPEATS = 500
    }

    /** Kullanicinin girdigi degerleri makul sinirlara oturtur. */
    fun sanitized() = copy(
        intervalSec = intervalSec.coerceIn(MIN_INTERVAL, MAX_INTERVAL),
        repeats = repeats.coerceIn(MIN_REPEATS, MAX_REPEATS),
        ringSec = ringSec.coerceIn(MIN_RING, MAX_RING)
    )

    /** Cevirilecek tam numara: dahili varsa duraklama ile eklenir. */
    fun dialString(): String {
        val base = number.filter { it.isDigit() || it in "+*#" }
        val ext = extension.filter { it.isDigit() || it in "*#" }
        return if (ext.isBlank()) base else "$base,,$ext"
    }
}
