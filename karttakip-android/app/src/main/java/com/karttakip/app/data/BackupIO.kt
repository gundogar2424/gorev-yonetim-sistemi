package com.karttakip.app.data

import org.json.JSONArray
import org.json.JSONObject

/**
 * Kart yedeklerini okuma/yazma.
 *
 * Iki formati da okur:
 *  - Eski "kart-defteri" yedegi: { cards: [{ bank, limit, avail, cutDate, dueDate, stmt, ... }] }
 *  - Bu uygulamanin kendi formati: { cards: [{ name, bank, statementDay, dueDay, limit, debt, ... }] }
 */
object BackupIO {

    private val palette = listOf(
        0xFF3B82F6L, 0xFFEF4444L, 0xFF22C55EL, 0xFFF59E0BL,
        0xFF8B5CF6L, 0xFFEC4899L, 0xFF14B8A6L, 0xFF64748BL
    )

    fun parse(text: String): List<Card> {
        val root = JSONObject(text)
        val arr = root.optJSONArray("cards") ?: JSONArray()
        val out = ArrayList<Card>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(fromJson(o))
        }
        return out
    }

    private fun fromJson(o: JSONObject): Card {
        // Isim: yeni format "name", eski format "bank"
        val rawName = o.optString("name").ifBlank { o.optString("bank") }.ifBlank { "Kart" }
        val bank = if (o.has("name")) o.optString("bank") else ""

        val statementDay =
            if (o.has("statementDay")) o.optInt("statementDay", 1)
            else dayOf(o.optString("cutDate"), 1)
        val dueDay =
            if (o.has("dueDay")) o.optInt("dueDay", 1)
            else dayOf(o.optString("dueDate"), 1)

        val limit = o.optDouble("limit", 0.0)
        // Borc onceligi: acik "debt" -> "stmt" (ekstre tutari) -> limit - avail (kullanilan)
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
            statementDay = statementDay.coerceIn(1, 31),
            dueDay = dueDay.coerceIn(1, 31),
            limit = limit.coerceAtLeast(0.0),
            debt = debt,
            colorArgb = color,
            remindDaysBefore = o.optInt("remindDaysBefore", 3).coerceIn(0, 30)
        )
    }

    /** "2026-06-15" -> 15 ; "15" -> 15 ; bos/gecersiz -> fallback */
    private fun dayOf(dateOrDay: String?, fallback: Int): Int {
        if (dateOrDay.isNullOrBlank()) return fallback
        val parts = dateOrDay.split("-", "/", ".")
        val dayStr = if (parts.size >= 3) parts.last() else dateOrDay
        return dayStr.trim().toIntOrNull()?.coerceIn(1, 31) ?: fallback
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
                    .put("statementDay", c.statementDay)
                    .put("dueDay", c.dueDay)
                    .put("limit", c.limit)
                    .put("debt", c.debt)
                    .put("colorArgb", c.colorArgb)
                    .put("remindDaysBefore", c.remindDaysBefore)
            )
        }
        return JSONObject()
            .put("app", "kart-takip")
            .put("cards", arr)
            .toString(2)
    }
}
