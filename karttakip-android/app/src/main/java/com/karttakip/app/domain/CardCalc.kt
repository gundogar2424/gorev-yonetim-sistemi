package com.karttakip.app.domain

import com.karttakip.app.data.Card
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Kredi karti tarih hesaplamalari.
 *
 * "Bugun hangi kart?" mantigi:
 *   Bugun yapilan bir harcama, bir sonraki KESIM ile kapanan ekstreye girer.
 *   O ekstrenin son odemesi ne kadar ileridyse, para o kadar uzun sure cepte
 *   kalir (faizsiz). Dolayisiyla EN MANTIKLI KART = en cok "faizsiz gun" saglayan.
 */
object CardCalc {

    /** Ayin [day] gunu icin, [from] tarihinden (dahil) sonraki ilk gecerli tarih. */
    fun nextOccurrence(day: Int, from: LocalDate): LocalDate {
        val thisMonth = clampToMonth(from.year, from.monthValue, day)
        if (!thisMonth.isBefore(from)) return thisMonth
        val nm = from.plusMonths(1)
        return clampToMonth(nm.year, nm.monthValue, day)
    }

    /** Ayin [day] gunu icin, [after] tarihinden KESIN sonra (haric) ilk gecerli tarih. */
    fun nextOccurrenceStrictAfter(day: Int, after: LocalDate): LocalDate {
        val thisMonth = clampToMonth(after.year, after.monthValue, day)
        if (thisMonth.isAfter(after)) return thisMonth
        val nm = after.plusMonths(1)
        return clampToMonth(nm.year, nm.monthValue, day)
    }

    private fun clampToMonth(year: Int, month: Int, day: Int): LocalDate {
        val len = LocalDate.of(year, month, 1).lengthOfMonth()
        return LocalDate.of(year, month, day.coerceIn(1, len))
    }

    fun nextStatement(card: Card, today: LocalDate = LocalDate.now()): LocalDate =
        nextOccurrence(card.statementDay, today)

    fun nextDue(card: Card, today: LocalDate = LocalDate.now()): LocalDate =
        nextOccurrence(card.dueDay, today)

    /**
     * Bugun bu kartla yapilan harcamanin son odeme tarihi.
     * Harcama, bir sonraki kesimle kapanan ekstreye girer; o ekstrenin son odeme
     * gunu, kesimden SONRAKI ilk [Card.dueDay] gunudur.
     */
    fun purchaseDueDate(card: Card, today: LocalDate = LocalDate.now()): LocalDate {
        val cut = nextStatement(card, today)
        return nextOccurrenceStrictAfter(card.dueDay, cut)
    }

    /** Bugun bu kartla harcarsam kac gun sonra odemem gerekir (ne kadar cok, o kadar iyi). */
    fun floatDays(card: Card, today: LocalDate = LocalDate.now()): Long =
        ChronoUnit.DAYS.between(today, purchaseDueDate(card, today))

    fun daysUntil(date: LocalDate, today: LocalDate = LocalDate.now()): Long =
        ChronoUnit.DAYS.between(today, date)

    /** En uzun faizsiz sure saglayan kart (bugun harcama icin en mantikli). */
    fun bestCardToUse(cards: List<Card>, today: LocalDate = LocalDate.now()): Card? =
        cards.maxByOrNull { floatDays(it, today) }

    /**
     * En acil odeme: borcu olan kartlar arasinda son odeme tarihi en yakin olan.
     * Borcu girilmemis (0) kartlar da dikkate alinir ama borclu olanlar oncelikli.
     */
    fun mostUrgentPayment(cards: List<Card>, today: LocalDate = LocalDate.now()): Card? {
        val withDebt = cards.filter { it.debt > 0.0 }
        val pool = if (withDebt.isNotEmpty()) withDebt else cards
        return pool.minByOrNull { nextDue(it, today) }
    }
}
