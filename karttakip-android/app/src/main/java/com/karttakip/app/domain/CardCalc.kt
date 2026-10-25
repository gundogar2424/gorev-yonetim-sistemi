package com.karttakip.app.domain

import com.karttakip.app.data.Card
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

/**
 * Kredi karti tarih hesaplamalari.
 *
 * Kartlar, kullanicinin sectigi kesim/son odeme TARIHINI saklar. Bu tarihin
 * GUNU her ay korunur; uygulama tarihi bugune/sonrasina tasiyarak "bir sonraki"
 * kesim ve son odeme tarihini bulur. Boylece kullanici "14 Agustos" secince
 * 14 Agustos gorunur (bugun 14 Temmuz olsa bile), ay gectikce ileri kayar.
 *
 * "Bugun hangi kart?" mantigi: bugun yapilan harcama bir sonraki KESIM ile
 * kapanan ekstreye girer; o ekstrenin son odemesi ne kadar ileridyse para o
 * kadar uzun sure cepte kalir (faizsiz). En mantikli kart = en cok faizsiz gun.
 */
object CardCalc {

    private fun clampToMonth(ym: YearMonth, day: Int): LocalDate =
        ym.atDay(day.coerceIn(1, ym.lengthOfMonth()))

    /**
     * Referans tarihinin GUNUNU koruyarak, [today]'den (dahil) itibaren
     * bir sonraki gecerli tarihi dondurur.
     */
    fun nextFromAnchor(epochDay: Long, today: LocalDate = LocalDate.now()): LocalDate {
        val anchor = LocalDate.ofEpochDay(epochDay)
        val day = anchor.dayOfMonth
        var ym = if (anchor.isBefore(today)) YearMonth.from(today) else YearMonth.from(anchor)
        var d = clampToMonth(ym, day)
        while (d.isBefore(today)) {
            ym = ym.plusMonths(1)
            d = clampToMonth(ym, day)
        }
        return d
    }

    /** Ayin [day] gunu icin, [after] tarihinden KESIN sonra (haric) ilk gecerli tarih. */
    fun nextOccurrenceStrictAfter(day: Int, after: LocalDate): LocalDate {
        val thisMonth = clampToMonth(YearMonth.from(after), day)
        if (thisMonth.isAfter(after)) return thisMonth
        val nm = YearMonth.from(after).plusMonths(1)
        return clampToMonth(nm, day)
    }

    fun statementDayOfMonth(card: Card): Int = LocalDate.ofEpochDay(card.statementEpochDay).dayOfMonth
    fun dueDayOfMonth(card: Card): Int = LocalDate.ofEpochDay(card.dueEpochDay).dayOfMonth

    fun nextStatement(card: Card, today: LocalDate = LocalDate.now()): LocalDate =
        nextFromAnchor(card.statementEpochDay, today)

    fun nextDue(card: Card, today: LocalDate = LocalDate.now()): LocalDate =
        nextFromAnchor(card.dueEpochDay, today)

    /**
     * Odenmesi gereken GUNCEL son odeme tarihi. "ödedim" denene kadar ilerlemez;
     * bu yuzden tarih gecse bile (gecikmis) ayni tarihte kalir ve hatirlatma surer.
     * "ödedim" dendiginde [Card.lastPaidDueEpochDay] guncellenir ve bir sonraki
     * donguye gecer.
     */
    fun currentDue(card: Card, today: LocalDate = LocalDate.now()): LocalDate {
        val day = dueDayOfMonth(card)
        val paidThrough: LocalDate =
            if (card.lastPaidDueEpochDay > 0L) LocalDate.ofEpochDay(card.lastPaidDueEpochDay)
            // Hic "ödedim" denmemis: bu dongunun bir oncesini baz al ki gecmis aylar
            // icin bogmasin; nag bir sonraki son odemeden itibaren baslar.
            else nextFromAnchor(card.dueEpochDay, today).minusMonths(1)
        var ym = YearMonth.from(paidThrough)
        var d = clampToMonth(ym, day)
        while (!d.isAfter(paidThrough)) {
            ym = ym.plusMonths(1)
            d = clampToMonth(ym, day)
        }
        return d
    }

    /** Yeni kart olustururken/aktarirken ilk donguden itibaren takip baslatmak icin. */
    fun initialLastPaid(dueEpochDay: Long, today: LocalDate = LocalDate.now()): Long =
        nextFromAnchor(dueEpochDay, today).minusMonths(1).toEpochDay()

    /**
     * Verilen son odeme tarihinin ait oldugu ekstrenin kesim tarihi.
     * (Son odemeden onceki, en yakin kesim gunu.) Boylece kart ekraninda
     * kesim -> son odeme hep ayni dongu ve dogru sirada gosterilir.
     */
    fun statementForDue(card: Card, dueDate: LocalDate): LocalDate {
        val k = statementDayOfMonth(card)
        var ym = YearMonth.from(dueDate)
        var cut = clampToMonth(ym, k)
        if (cut.isAfter(dueDate)) {
            ym = ym.minusMonths(1)
            cut = clampToMonth(ym, k)
        }
        return cut
    }

    /**
     * Bugun bu kartla yapilan harcamanin son odeme tarihi: harcama bir sonraki
     * kesimle kapanan ekstreye girer; o ekstrenin son odemesi kesimden SONRAKI
     * ilk son-odeme-gunudur.
     */
    fun purchaseDueDate(card: Card, today: LocalDate = LocalDate.now()): LocalDate {
        val cut = nextStatement(card, today)
        return nextOccurrenceStrictAfter(dueDayOfMonth(card), cut)
    }

    /** Bugun bu kartla harcarsam kac gun sonra odemem gerekir (ne kadar cok, o kadar iyi). */
    fun floatDays(card: Card, today: LocalDate = LocalDate.now()): Long =
        ChronoUnit.DAYS.between(today, purchaseDueDate(card, today))

    fun daysUntil(date: LocalDate, today: LocalDate = LocalDate.now()): Long =
        ChronoUnit.DAYS.between(today, date)

    /** Bugune kadar (dahil) en son kesilen ekstre (kesim) tarihi. */
    fun lastStatementCut(card: Card, today: LocalDate = LocalDate.now()): LocalDate {
        val k = statementDayOfMonth(card)
        var ym = YearMonth.from(today)
        var cut = clampToMonth(ym, k)
        if (cut.isAfter(today)) {
            ym = ym.minusMonths(1)
            cut = clampToMonth(ym, k)
        }
        return cut
    }

    /**
     * Kart "ekstre borcunu gir" diye yanip sonmeli mi?
     * Ekstre en son girildikten SONRA yeni bir ekstre kesildiyse true.
     * (ekstreForStatementEpochDay 0 ise takip baslamamistir -> yanip sonmez.)
     */
    fun needsStatementEntry(card: Card, today: LocalDate = LocalDate.now()): Boolean =
        card.ekstreForStatementEpochDay > 0L &&
            lastStatementCut(card, today).toEpochDay() > card.ekstreForStatementEpochDay

    /** En uzun faizsiz sure saglayan kart (bugun harcama icin en mantikli). */
    fun bestCardToUse(cards: List<Card>, today: LocalDate = LocalDate.now()): Card? =
        cards.maxByOrNull { floatDays(it, today) }

    /** En acil odeme: guncel son odeme tarihi en yakin (veya en cok gecikmis) kart. */
    fun mostUrgentPayment(cards: List<Card>, today: LocalDate = LocalDate.now()): Card? =
        cards.minByOrNull { currentDue(it, today) }
}
