package com.otoara.app.call

import android.os.SystemClock

/**
 * Arama ekranindan okunan canli bilgiler. [SpeakerService] yazar, servis okur.
 *
 * Android, varsayilan telefon uygulamasi olmayan uygulamalara "karsi taraf
 * acti" bilgisini vermez. Ama arama ekranindaki **gorusme sayaci** (00:12
 * gibi) ancak cagri cevaplandiktan sonra baslar ve saniye saniye ilerler.
 * Erisilebilirlik izni verilmisse bu sayacin ilerledigini gorup cevaplanmayi
 * kesin olarak anlayabiliyoruz.
 */
object CallScreen {

    /** Sayacin ilerledigi ilk an (elapsedRealtime); 0 = henuz cevaplanmadi. */
    @Volatile var answeredAt: Long = 0L
        private set

    /** En son gorulen sayac metni — ilerledigini anlamak icin. */
    @Volatile private var lastTimer: String? = null

    /** Arama ekraninin paket adi — tanilama icin. */
    @Volatile var dialerPackage: String? = null

    val answered: Boolean get() = answeredAt > 0L

    /** Her yeni arama denemesinden once temizlenir. */
    fun reset() {
        answeredAt = 0L
        lastTimer = null
    }

    /**
     * Ekranda gorulen sayac metnini bildirir. Ayni deger tekrar gelirse bir sey
     * olmaz; **degisirse** sayac ilerliyor demektir, yani cagri cevaplanmistir.
     */
    fun reportTimer(text: String) {
        val previous = lastTimer
        lastTimer = text
        if (previous != null && previous != text && answeredAt == 0L) {
            answeredAt = SystemClock.elapsedRealtime()
        }
    }
}
