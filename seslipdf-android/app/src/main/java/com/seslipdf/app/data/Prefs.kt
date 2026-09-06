package com.seslipdf.app.data

import android.content.Context

/**
 * Okuma ayarlari (hiz, ton, ses, uyku sayaci...) telefonda saklanir; uygulama
 * kapanip acilinca ayni degerlerle gelir.
 */
class Prefs(context: Context) {

    private val sp = context.applicationContext
        .getSharedPreferences("seslipdf", Context.MODE_PRIVATE)

    /** Konusma hizi (1.0 = normal). */
    var rate: Float
        get() = sp.getFloat("rate", 1.0f)
        set(v) = sp.edit().putFloat("rate", v.coerceIn(MIN_RATE, MAX_RATE)).apply()

    /** Ses tonu (1.0 = normal). */
    var pitch: Float
        get() = sp.getFloat("pitch", 1.0f)
        set(v) = sp.edit().putFloat("pitch", v.coerceIn(MIN_PITCH, MAX_PITCH)).apply()

    /** Secili sesin adi (TextToSpeech.Voice.name); bos ise sistem varsayilani. */
    var voice: String
        get() = sp.getString("voice", "") ?: ""
        set(v) = sp.edit().putString("voice", v).apply()

    /** En iyi ses bir kez otomatik secildi mi (kullanici sonra degistirebilir). */
    var voiceAutoPicked: Boolean
        get() = sp.getBoolean("voiceAuto", false)
        set(v) = sp.edit().putBoolean("voiceAuto", v).apply()

    /** Dil kodu (ornegin tr-TR). */
    var language: String
        get() = sp.getString("lang", "tr-TR") ?: "tr-TR"
        set(v) = sp.edit().putString("lang", v).apply()

    /** Okurken ekran acik kalsin mi. */
    var keepAwake: Boolean
        get() = sp.getBoolean("keepAwake", false)
        set(v) = sp.edit().putBoolean("keepAwake", v).apply()

    /** Okunan cumle ekranda ortalansin mi. */
    var autoScroll: Boolean
        get() = sp.getBoolean("autoScroll", true)
        set(v) = sp.edit().putBoolean("autoScroll", v).apply()

    /**
     * Okunan cumleye gecerken listenin kayma hizi (0 = agir agir suzulur,
     * 1 = hemen atlar). Metnin akisini goz takip edebilsin diye ayarlanabilir.
     */
    var scrollSpeed: Float
        get() = sp.getFloat("scrollSpeed", 0.55f)
        set(v) = sp.edit().putFloat("scrollSpeed", v.coerceIn(0f, 1f)).apply()

    /** Sessiz okuma modu: ses kapali, yazi kendi kendine akar. */
    var silentMode: Boolean
        get() = sp.getBoolean("silent", false)
        set(v) = sp.edit().putBoolean("silent", v).apply()

    /** Sessiz moddaki akis hizi (0 = cok yavas, 1 = cok hizli). */
    var flowSpeed: Float
        get() = sp.getFloat("flowSpeed", 0.45f)
        set(v) = sp.edit().putFloat("flowSpeed", v.coerceIn(0f, 1f)).apply()

    /** Uyku sayaci icin son secilen sure (dakika). */
    var sleepMinutes: Int
        get() = sp.getInt("sleepMinutes", 30)
        set(v) = sp.edit().putInt("sleepMinutes", v).apply()

    /** Metin katmani bos gelirse sayfalar OCR ile okunsun mu. */
    var ocrFallback: Boolean
        get() = sp.getBoolean("ocr", true)
        set(v) = sp.edit().putBoolean("ocr", v).apply()

    /** Her sayfada tekrarlanan ustbilgi/altbilgi satirlari atilsin mi. */
    var stripRunningHeads: Boolean
        get() = sp.getBoolean("stripHeads", true)
        set(v) = sp.edit().putBoolean("stripHeads", v).apply()

    /** En son okunan belge (uygulama acilisinda dogrudan ona gitmek icin). */
    var lastDocId: Long
        get() = sp.getLong("lastDoc", 0L)
        set(v) = sp.edit().putLong("lastDoc", v).apply()

    companion object {
        const val MIN_RATE = 0.4f
        const val MAX_RATE = 3.0f
        const val MIN_PITCH = 0.5f
        const val MAX_PITCH = 2.0f
    }
}
