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

    /** En son gorulen sayac degeri (saniye). */
    @Volatile private var lastSeconds: Int? = null

    /** Pes pese kac kez birer saniye artti. */
    @Volatile private var increments = 0

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
        lastSeconds = null
        increments = 0
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
     * Ekranda gorulen "dd:dd" metnini bildirir.
     *
     * Her `dd:dd` metni gorusme sayaci degildir — arama ekraninda saat gibi
     * baska metinler de bu bicimde olabiliyor ve bunlari sayac sanmak yanlis
     * "cevaplandi" sonucuna yol aciyordu. Bu yuzden sayac sayilmasi icin:
     *
     *  1. **sifira yakin** bir degerden baslamali (gorusme 00:00'dan sayar),
     *  2. **saniye saniye artmali**,
     *  3. bu artis pes pese en az [NEEDED_INCREMENTS] kez gorulmeli.
     */
    fun reportTimer(text: String) {
        val seconds = parseSeconds(text) ?: return
        timerText = text

        val previous = lastSeconds
        if (previous == null) {
            // Ilk deger: sayac ancak bastan yakalanirsa guvenilir.
            if (seconds <= FIRST_MAX_SECONDS) {
                lastSeconds = seconds
                increments = 0
            }
            return
        }

        when (seconds - previous) {
            0 -> return // ayni saniye, yeni bilgi yok
            in 1..3 -> {
                lastSeconds = seconds
                increments++
                if (increments >= NEEDED_INCREMENTS && answeredAt == 0L) {
                    answeredAt = SystemClock.elapsedRealtime()
                }
            }
            else -> {
                // Sicrama: bu metin gorusme sayaci degil. Bastan basla.
                lastSeconds = if (seconds <= FIRST_MAX_SECONDS) seconds else null
                increments = 0
            }
        }
    }

    /** "0:07" / "00:07" / "1:02:03" -> saniye. Uymayan metin icin null. */
    fun parseSeconds(text: String): Int? {
        val parts = text.split(':')
        if (parts.size !in 2..3) return null
        val numbers = parts.map { it.toIntOrNull() ?: return null }
        return when (numbers.size) {
            2 -> numbers[0] * 60 + numbers[1]
            else -> numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
        }
    }

    /** Sayacin yakalandigi kabul edilecek en buyuk baslangic degeri. */
    private const val FIRST_MAX_SECONDS = 15

    /** "Cevaplandi" demek icin gereken pes pese artis sayisi. */
    private const val NEEDED_INCREMENTS = 3
}
