package com.seslipdf.app.pdf

import java.util.Locale

/**
 * Metni ses motoruna vermeden once Türkçe okunusa cevirir.
 *
 * Ses motorlari "1923", "%20" ya da "BİRİNCİ BÖLÜM" gibi yazilari okunusa
 * ceviremiyor; rakam rakam ya da harf harf okuyor. Burada yazi, bir insanin
 * sesli okurken soyleyecegi bicime getirilir. Ekranda gorunen metin degismez,
 * yalnizca sese giden metin.
 */
object SpokenText {

    private val TR = Locale.forLanguageTag("tr-TR")

    private val ONES = arrayOf("", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz")
    private val TENS = arrayOf("", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan")
    private val SCALES = arrayOf("", "bin", "milyon", "milyar", "trilyon")
    private val MONTHS = arrayOf(
        "", "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
        "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"
    )
    private val DIGIT_NAMES = arrayOf("sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz")

    private const val VOWELS = "aeıioöuüAEIİOÖUÜ"

    fun prepare(text: String): String {
        var t = text

        // 12.03.2024 / 12/03/2024 -> "on iki mart iki bin yirmi dört"
        t = Regex("""(?<![\d.,])(\d{1,2})[./](\d{1,2})[./](\d{4})(?![\d.,])$SUFFIX""").replace(t) { m ->
            val (d, mo, y, suffix) = m.destructured
            val month = mo.toInt()
            if (d.toInt() in 1..31 && month in 1..12) {
                "${words(d.toLong())} ${MONTHS[month]} ${words(y.toLong())}$suffix"
            } else m.value
        }

        // 14:30 -> "on dört otuz"; 09:05 -> "dokuz sıfır beş"
        t = Regex("""(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])$SUFFIX""").replace(t) { m ->
            val (h, min, suffix) = m.destructured
            if (h.toInt() > 23 || min.toInt() > 59) return@replace m.value
            val minutes = when {
                min == "00" -> ""
                min.startsWith("0") -> "sıfır ${words(min.toLong())}"
                else -> words(min.toLong())
            }
            "${words(h.toLong())} $minutes".trim() + suffix
        }

        // %20, % 20, 20% -> "yüzde yirmi"
        t = Regex("""%\s?(\d+(?:,\d+)?)$SUFFIX""").replace(t) { m ->
            "yüzde ${number(m.groupValues[1])}${m.groupValues[2]}"
        }
        t = Regex("""(?<![\d,])(\d+(?:,\d+)?)\s?%$SUFFIX""").replace(t) { m ->
            "yüzde ${number(m.groupValues[1])}${m.groupValues[2]}"
        }

        // 1914-1918 -> iki sayi arasinda kisa duraklama
        t = Regex("""(\d)\s?[-–—]\s?(\d)""").replace(t) { m -> "${m.groupValues[1]}, ${m.groupValues[2]}" }

        // Roma rakamiyla sira sayisi: "II. Abdülhamit", "XVI. yüzyıl", "I. Dünya Savaşı"
        t = Regex("""(?<![\p{L}\d.])([IVXLC]{1,7})\.(?=\s+\p{L})""").replace(t) { m ->
            roman(m.groupValues[1])?.let { ordinal(it.toLong()) } ?: m.value
        }
        // "BÖLÜM IV", "Kısım II" -> bolum dort, kisim iki
        t = Regex(
            // Anahtar kelime Türkçe buyuk/kucuk harf farketmeksizin (u = Unicode);
            // Roma rakami ise yalnizca buyuk harf ("madde c" yuz diye okunmasin).
            """(?<!\p{L})((?iu:bölüm|kısım|cilt|kitap|madde|ünite|sure|perde))\s+([IVXLC]{1,7})(?!\p{L})"""
        ).replace(t) { m ->
            roman(m.groupValues[2])?.let { "${m.groupValues[1]} ${words(it.toLong())}" } ?: m.value
        }

        // Sira sayisi: cumle icinde "19. yüzyıl", "2. Dünya Savaşı"
        // (cumle ayirici "sayı." sonrasinda bolmedigi icin burada hep sira sayisidir)
        t = Regex("""(?<![\d.,])(\d{1,6})\.(?=\s+\p{L})""").replace(t) { m ->
            ordinal(m.groupValues[1].toLong())
        }

        // Sayiya bitisik ek: 1923'te -> "bin dokuz yüz yirmi üçte"
        t = Regex("""(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?['’](\p{L}+)""").replace(t) { m ->
            val whole = number(m.groupValues[1] + (if (m.groupValues[2].isNotEmpty()) "," + m.groupValues[2] else ""))
            whole + m.groupValues[3]
        }

        // Kalan sayilar: 1.250.000 / 15,5 / 1923 / 007
        t = Regex("""(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?![\d])""").replace(t) { m ->
            val decimals = m.groupValues[2]
            number(m.groupValues[1] + if (decimals.isNotEmpty()) ",$decimals" else "")
        }

        // TAMAMI BUYUK HARF kelimeler: okunabilir olanlar normal kelime gibi,
        // gercek kisaltmalar (TBMM, ABD, PDF) harf harf kalsin.
        t = Regex("""\p{Lu}{2,}""").replace(t) { m ->
            val word = m.value
            val vowels = word.count { it in VOWELS }
            if (word.length >= 4 && vowels >= 2) word.lowercase(TR) else word
        }

        return t.replace(Regex("""\s{2,}"""), " ").trim()
    }

    /** Sayidan sonra gelen istege bagli ek: 14:30'da, %20'si, 12.03.2024'te. */
    private const val SUFFIX = """(?:['’](\p{L}+))?"""

    /** Roma rakamini sayiya cevirir; gecersizse null. */
    private fun roman(text: String): Int? {
        val values = mapOf('I' to 1, 'V' to 5, 'X' to 10, 'L' to 50, 'C' to 100)
        var total = 0
        for (i in text.indices) {
            val v = values[text[i]] ?: return null
            val next = if (i + 1 < text.length) values[text[i + 1]] ?: return null else 0
            total += if (v < next) -v else v
        }
        // "IIII", "VV" gibi gecersizleri ele: geri yazinca ayni olmali
        return if (total in 1..399 && toRoman(total) == text) total else null
    }

    private fun toRoman(n: Int): String {
        val pairs = listOf(100 to "C", 90 to "XC", 50 to "L", 40 to "XL", 10 to "X", 9 to "IX", 5 to "V", 4 to "IV", 1 to "I")
        var rest = n
        val sb = StringBuilder()
        for ((v, r) in pairs) while (rest >= v) { sb.append(r); rest -= v }
        return sb.toString()
    }

    /** "1.250.000", "15,5", "007" gibi bir sayi yazisini okunusa cevirir. */
    private fun number(raw: String): String {
        val parts = raw.split(",", limit = 2)
        val intPart = parts[0].replace(".", "")
        val whole = if (intPart.length > 1 && intPart.startsWith("0")) {
            // Basi sifirla baslayan (007, telefon, kod): rakam rakam
            intPart.map { DIGIT_NAMES[it - '0'] }.joinToString(" ")
        } else {
            intPart.toLongOrNull()?.let { if (it < 1_000_000_000_000_000L) words(it) else null }
                ?: intPart.map { DIGIT_NAMES[it - '0'] }.joinToString(" ")
        }
        if (parts.size == 1) return whole
        val dec = parts[1]
        val decWords = if (dec.startsWith("0")) {
            dec.map { DIGIT_NAMES[it - '0'] }.joinToString(" ")
        } else {
            dec.toLongOrNull()?.let { words(it) } ?: dec.map { DIGIT_NAMES[it - '0'] }.joinToString(" ")
        }
        return "$whole virgül $decWords"
    }

    /** Tam sayiyi Türkçe okunusa cevirir: 1923 -> "bin dokuz yüz yirmi üç". */
    fun words(n: Long): String {
        if (n == 0L) return "sıfır"
        if (n < 0) return "eksi " + words(-n)
        val groups = mutableListOf<Int>()
        var rest = n
        while (rest > 0) {
            groups += (rest % 1000).toInt()
            rest /= 1000
        }
        val out = mutableListOf<String>()
        for (i in groups.indices.reversed()) {
            val g = groups[i]
            if (g == 0) continue
            // "bin" basina "bir" almaz: 1000 -> "bin", ama 1.000.000 -> "bir milyon"
            if (i == 1 && g == 1) {
                out += "bin"
                continue
            }
            out += hundreds(g)
            if (i > 0) out += SCALES[i]
        }
        return out.joinToString(" ")
    }

    private fun hundreds(n: Int): String {
        val h = n / 100
        val t = (n % 100) / 10
        val o = n % 10
        val out = mutableListOf<String>()
        if (h > 0) out += if (h == 1) "yüz" else "${ONES[h]} yüz"
        if (t > 0) out += TENS[t]
        if (o > 0) out += ONES[o]
        return out.joinToString(" ")
    }

    /** Sira sayisi: 3 -> "üçüncü", 19 -> "on dokuzuncu", 4 -> "dördüncü". */
    fun ordinal(n: Long): String {
        val base = words(n)
        val lastWord = base.substringAfterLast(' ')
        val head = base.removeSuffix(lastWord)
        val stem = if (lastWord == "dört") "dörd" else lastWord
        val lastVowel = stem.lastOrNull { it in VOWELS } ?: 'i'
        val v = when (lastVowel) {
            'a', 'ı' -> 'ı'
            'e', 'i' -> 'i'
            'o', 'u' -> 'u'
            else -> 'ü'
        }
        val suffix = if (stem.last() in VOWELS) "nc$v" else "${v}nc$v"
        return head + stem + suffix
    }
}
