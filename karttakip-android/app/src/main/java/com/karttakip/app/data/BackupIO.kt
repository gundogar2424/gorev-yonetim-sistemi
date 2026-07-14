package com.karttakip.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.YearMonth

/**
 * Kart yedeklerini okuma/yazma.
 *
 * Okuyabildigi tarih bicimleri (her alan icin sirasiyla denenir):
 *  - "statementEpochDay" / "dueEpochDay" (bu uygulamanin dis bicimi)
 *  - "cutDate" / "dueDate" tam tarih metni "2026-08-14" (eski "kart-defteri" ve export)
 *  - "statementDay" / "dueDay" ayin gunu (sadece gun) -> icinde bulunulan aya kurulur
 */
object BackupIO {

    private val palette = listOf(
        0xFF3B82F6L, 0xFFEF4444L, 0xFF22C55EL, 0xFFF59E0BL,
        0xFF8B5CF6L, 0xFFEC4899L, 0xFF14B8A6L, 0xFF64748BL
    )

    fun parse(text: String): List<Card> {
        val cleaned = text.trim().removePrefix("﻿").trim()
        val arr: JSONArray = if (cleaned.startsWith("[")) {
            JSONArray(cleaned)
        } else {
            val root = JSONObject(cleaned)
            root.optJSONArray("cards")
                ?: root.optJSONArray("kartlar")
                ?: root.optJSONArray("data")
                ?: JSONArray()
        }
        val today = LocalDate.now()
        val out = ArrayList<Card>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(fromJson(o, today))
        }
        return out
    }

    private fun fromJson(o: JSONObject, today: LocalDate): Card {
        val rawName = o.optString("name").ifBlank { o.optString("bank") }.ifBlank { "Kart" }
        val bank = if (o.has("name")) o.optString("bank") else ""

        val statementEpochDay = anchorEpochDay(o, "statementEpochDay", "cutDate", "statementDay", today)
        val dueEpochDay = anchorEpochDay(o, "dueEpochDay", "dueDate", "dueDay", today)

        val limit = o.optDouble("limit", 0.0)
        val debt = when {
            o.has("debt") -> o.optDouble("debt", 0.0)
            o.optDouble("stmt", 0.0) > 0.0 -> o.optDouble("stmt", 0.0)
            o.has("avail") -> (limit - o.optDouble("avail", limit)).coerceAtLeast(0.0)
            else -> 0.0
        }

        val color =
            if (o.has("colorArgb")) o.optLong("colorArgb", palette.first())
            else pickColor(rawName)

        return Card(
            name = rawName.trim(),
            bank = bank.trim(),
            statementEpochDay = statementEpochDay,
            dueEpochDay = dueEpochDay,
            limit = limit.coerceAtLeast(0.0),
            debt = debt,
            colorArgb = color,
            remindDaysBefore = o.optInt("remindDaysBefore", 3).coerceIn(0, 30)
        )
    }

    private fun anchorEpochDay(
        o: JSONObject, epochKey: String, dateKey: String, dayKey: String, today: LocalDate
    ): Long {
        if (o.has(epochKey)) return o.optLong(epochKey, today.toEpochDay())
        val ds = o.optString(dateKey)
        if (ds.isNotBlank()) parseDate(ds)?.let { return it.toEpochDay() }
        if (o.has(dayKey)) {
            val day = o.optInt(dayKey, today.dayOfMonth)
            return dateFromDay(day, today).toEpochDay()
        }
        return today.toEpochDay()
    }

    /** "2026-08-14" (veya "2026/8/14", tarih-saat ise ilk 10 hane) -> LocalDate */
    private fun parseDate(s: String): LocalDate? {
        val t = s.trim()
        runCatching { return LocalDate.parse(t.take(10)) }
        val parts = t.take(10).split("-", "/", ".").mapNotNull { it.trim().toIntOrNull() }
        if (parts.size >= 3) {
            val (y, m, d) = parts
            return runCatching {
                val ym = YearMonth.of(y, m.coerceIn(1, 12))
                ym.atDay(d.coerceIn(1, ym.lengthOfMonth()))
            }.getOrNull()
        }
        return null
    }

    private fun dateFromDay(day: Int, today: LocalDate): LocalDate {
        val ym = YearMonth.from(today)
        return ym.atDay(day.coerceIn(1, ym.lengthOfMonth()))
    }

    private fun pickColor(seed: String): Long {
        val idx = ((seed.hashCode().toLong() and 0x7fffffffL) % palette.size).toInt()
        return palette[idx]
    }

    fun toJson(cards: List<Card>): String {
        val arr = JSONArray()
        for (c in cards) {
            arr.put(
                JSONObject()
                    .put("name", c.name)
                    .put("bank", c.bank)
                    .put("cutDate", LocalDate.ofEpochDay(c.statementEpochDay).toString())
                    .put("dueDate", LocalDate.ofEpochDay(c.dueEpochDay).toString())
                    .put("statementEpochDay", c.statementEpochDay)
                    .put("dueEpochDay", c.dueEpochDay)
                    .put("limit", c.limit)
                    .put("debt", c.debt)
                    .put("colorArgb", c.colorArgb)
                    .put("remindDaysBefore", c.remindDaysBefore)
            )
        }
        return JSONObject().put("app", "kart-takip").put("cards", arr).toString(2)
    }
}
