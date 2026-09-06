package com.otoara.app.call

import android.os.SystemClock

/**
 * Arama ekranindan okunan canli bilgiler ve tanilama sayaclari.
 * [SpeakerService] yazar; [RedialService] ve ekran okur.
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

    @Volatile private var lastTimer: String? = null

    // ------------------------------------------------------------ tanilama

    /** Cagri sirasinda arama ekranindan kac olay alindi. */
    @Volatile var events: Int = 0
        private set

    /** Arama ekraninin paket adi (or. com.samsung.android.incallui). */
    @Volatile var dialerPackage: String? = null
        private set

    /** Hoparlor dugmesi ekranda bulundu mu. */
    @Volatile var speakerFound: Boolean = false
        private set

    /** Dugmeye basildi mi. */
    @Volatile var speakerClicked: Boolean = false
        private set

    /** Dugme "zaten acik" olarak isaretli miydi. */
    @Volatile var speakerAlreadyOn: Boolean = false
        private set

    /** Ekranda gorulen sayac (cevaplanma gostergesi). */
    @Volatile var timerText: String? = null
        private set

    val answered: Boolean get() = answeredAt > 0L

    /** Her yeni arama denemesinden once temizlenir. */
    fun reset() {
        answeredAt = 0L
        lastTimer = null
        events = 0
        speakerFound = false
        speakerClicked = false
        speakerAlreadyOn = false
        timerText = null
    }

    fun noteEvent(packageName: String?) {
        events++
        if (packageName != null) dialerPackage = packageName
    }

    fun noteSpeaker(found: Boolean, alreadyOn: Boolean, clicked: Boolean) {
        if (found) speakerFound = true
        if (alreadyOn) speakerAlreadyOn = true
        if (clicked) speakerClicked = true
    }

    /**
     * Ekranda gorulen sayac metnini bildirir. Ayni deger tekrar gelirse bir sey
     * olmaz; **degisirse** sayac ilerliyor demektir, yani cagri cevaplanmistir.
     */
    fun reportTimer(text: String) {
        val previous = lastTimer
        lastTimer = text
        timerText = text
        if (previous != null && previous != text && answeredAt == 0L) {
            answeredAt = SystemClock.elapsedRealtime()
        }
    }
}
