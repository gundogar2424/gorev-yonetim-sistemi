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

    /** En uzun faizsiz sure saglayan kart (bugun harcama icin en mantikli). */
    fun bestCardToUse(cards: List<Card>, today: LocalDate = LocalDate.now()): Card? =
        cards.maxByOrNull { floatDays(it, today) }

    /** En acil odeme: borcu olan kartlar arasinda son odeme tarihi en yakin olan. */
    fun mostUrgentPayment(cards: List<Card>, today: LocalDate = LocalDate.now()): Card? {
        val withDebt = cards.filter { it.debt > 0.0 }
        val pool = if (withDebt.isNotEmpty()) withDebt else cards
        return pool.minByOrNull { nextDue(it, today) }
    }
}
