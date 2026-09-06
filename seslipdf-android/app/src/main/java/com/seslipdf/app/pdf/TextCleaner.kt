package com.seslipdf.app.pdf

/**
 * PDF'ten cikan ham metni sesli okunabilir hale getirir.
 *
 * PDF bir metin dosyasi degildir: satirlar sayfadaki gorsel satirlardir, kelimeler
 * satir sonunda tire ile bolunur, her sayfanin basinda/sonunda kitap adi ve sayfa
 * numarasi tekrar eder. Bunlar temizlenmezse okuma "sayfa on iki" diye bolunur.
 */
object TextCleaner {

    /** Bir cumle bu uzunlugu asarsa virgul/bosluktan parcalanir (okuma akici kalsin). */
    private const val MAX_SENTENCE = 320

    /** Sonunda nokta olan ama cumleyi bitirmeyen kisaltmalar. */
    private val ABBREVIATIONS = setOf(
        "dr", "doç", "prof", "op", "uzm", "av", "sn", "bkz", "vb", "vs", "örn", "ör",
        "yy", "sf", "s", "no", "nr", "tel", "faks", "md", "mah", "cad", "sok", "apt",
        "bl", "kat", "yrd", "arş", "gör", "öğr", "müh", "alb", "gen", "sy", "c", "bk",
        "hz", "st", "mr", "mrs", "ms", "jr", "vol", "fig", "ed", "etc", "inc", "ltd",
        "a.g.e", "a.g.m", "bkz.", "m.ö", "m.s", "t.c", "vd", "çev", "haz", "der"
    )

    /** Turkce dahil kucuk harfler — nokta sonrasi kucuk harf geliyorsa cumle bitmemistir. */
    private fun Char.isLowerLetter() = isLetter() && isLowerCase()

    /**
     * Tek bir sayfanin ham metnini duzeltir: tire ile bolunmus kelimeleri birlestirir,
     * paragraf icindeki satir sonlarini bosluga cevirir, fazla boslugu atar.
     */
    fun cleanPage(raw: String): String {
        var text = raw
            .replace(' ', ' ')      // kirilmayan bosluk
            .replace(' ', '\n')
            .replace("\r\n", "\n")
            .replace('\r', '\n')
            .replace("ﬁ", "fi")     // fi baglaci
            .replace("ﬂ", "fl")     // fl baglaci
            .replace("ﬀ", "ff")
            .replace('’', '\'')
            .replace('“', '"')
            .replace('”', '"')

        // Satir sonunda tire ile bolunmus kelimeler: "keli-\nme" -> "kelime"
        text = Regex("(\\p{L})[-‐‑­]\\n\\s*(\\p{L})")
            .replace(text) { m -> m.groupValues[1] + m.groupValues[2] }

        // Paragraflar bos satirla ayrilir; paragraf icindeki satir sonlari bosluk olur.
        val blocks = text.split(Regex("\n[ \t]*\n+")).map { block ->
            block.replace('\n', ' ').replace(Regex("[ \t]+"), " ").trim()
        }.filter { it.isNotBlank() }

        return blocks.joinToString("\n\n")
    }

    /**
     * Her sayfada tekrarlanan ustbilgi/altbilgi satirlarini (kitap adi, bolum adi,
     * sayfa numarasi) atar. Yalnizca sayfa sayisi 4'ten fazlaysa calisir.
     */
    fun stripRunningHeads(pages: List<String>): List<String> {
        if (pages.size < 4) return pages.map { dropLoneNumbers(it) }

        val firstLines = mutableMapOf<String, Int>()
        val lastLines = mutableMapOf<String, Int>()
        val lineLists = pages.map { it.lines().map(String::trim).filter(String::isNotBlank) }

        lineLists.forEach { lines ->
            lines.firstOrNull()?.let { firstLines[fingerprint(it)] = (firstLines[fingerprint(it)] ?: 0) + 1 }
            lines.lastOrNull()?.let { lastLines[fingerprint(it)] = (lastLines[fingerprint(it)] ?: 0) + 1 }
        }

        val threshold = (pages.size * 0.4).toInt().coerceAtLeast(3)
        val badFirst = firstLines.filterValues { it >= threshold }.keys
        val badLast = lastLines.filterValues { it >= threshold }.keys

        return lineLists.map { lines ->
            var kept = lines
            if (kept.isNotEmpty() && fingerprint(kept.first()) in badFirst) kept = kept.drop(1)
            if (kept.isNotEmpty() && fingerprint(kept.last()) in badLast) kept = kept.dropLast(1)
            dropLoneNumbers(kept.joinToString("\n"))
        }
    }

    /** Tek basina duran sayfa numarasi satirlarini atar ("12", "- 12 -", "Sayfa 12"). */
    private fun dropLoneNumbers(text: String): String =
        text.lines()
            .filterNot { line ->
                val t = line.trim()
                t.isNotEmpty() && t.length <= 14 &&
                    Regex("^([-–—•|\\s]*)(sayfa|page|s\\.)?[\\s|-]*\\d{1,4}([-–—•|\\s]*)$", RegexOption.IGNORE_CASE)
                        .matches(t)
            }
            .joinToString("\n")

    /** Sayfa numaralari degisse de ayni ustbilgi taninsin diye rakamlar maskelenir. */
    private fun fingerprint(line: String): String =
        line.lowercase().replace(Regex("\\d+"), "#").replace(Regex("\\s+"), " ").trim()

    /**
     * Metni cumlelere ayirir. Kisaltmalar ("Dr.", "vb."), tarihler ("12.03.2024") ve
     * madde numaralari ("1. Giriş") cumle sonu sayilmaz.
     */
    fun splitSentences(text: String): List<String> {
        val out = mutableListOf<String>()
        val paragraphs = text.split(Regex("\n{2,}"))

        for (paragraph in paragraphs) {
            val clean = paragraph.replace(Regex("\\s+"), " ").trim()
            if (clean.isBlank()) continue

            val buffer = StringBuilder()
            var index = 0
            while (index < clean.length) {
                val ch = clean[index]
                buffer.append(ch)

                val endsHere = when (ch) {
                    '.', '!', '?', '…' -> isBoundary(clean, index)
                    else -> false
                }

                if (endsHere) {
                    // Ard arda gelen isaretleri ("?!", "...") ayni cumlede tut.
                    var next = index + 1
                    while (next < clean.length && clean[next] in ".!?…\"'»)]") {
                        buffer.append(clean[next]); next++
                    }
                    index = next
                    flush(buffer, out)
                    continue
                }
                index++
            }
            flush(buffer, out)
        }
        return out
    }

    /** Noktanin gercekten cumle sonu olup olmadigina karar verir. */
    private fun isBoundary(text: String, dotIndex: Int): Boolean {
        val next = text.getOrNull(dotIndex + 1)
        // Nokta bir bosluktan once degilse cumle bitmemistir (12.03, www.abc.com).
        if (next != null && !next.isWhitespace()) return false

        // Bosluktan sonraki ilk harf kucukse cumle devam ediyordur.
        val after = text.drop(dotIndex + 1).trimStart().firstOrNull()
        if (after != null && after.isLowerLetter()) return false

        if (text[dotIndex] != '.') return true

        // Noktadan onceki kelime bir kisaltma mi?
        val before = text.substring(0, dotIndex).takeLastWhile { !it.isWhitespace() }
        val word = before.trimStart('(', '[', '"', '\'', '«').lowercase()
        if (word.isEmpty()) return false
        if (word in ABBREVIATIONS) return false
        // "M.Ö." gibi tek harfli kisaltma zincirleri
        if (word.length <= 2 && word.all { it.isLetter() || it == '.' }) return false
        // Madde numaralari: "1.", "12." -> cumle sonu degil
        if (word.all { it.isDigit() }) return false
        return true
    }

    /** Cumleyi listeye ekler; cok uzunsa okunabilir parcalara boler. */
    private fun flush(buffer: StringBuilder, out: MutableList<String>) {
        val sentence = buffer.toString().trim()
        buffer.setLength(0)
        if (sentence.isBlank()) return
        if (sentence.length <= MAX_SENTENCE) {
            out += sentence
            return
        }
        var rest = sentence
        while (rest.length > MAX_SENTENCE) {
            val window = rest.take(MAX_SENTENCE)
            val cut = listOf(
                window.lastIndexOf("; "), window.lastIndexOf(", "),
                window.lastIndexOf(" – "), window.lastIndexOf(" ")
            ).firstOrNull { it > MAX_SENTENCE / 3 } ?: MAX_SENTENCE
            out += rest.take(cut + 1).trim()
            rest = rest.drop(cut + 1).trim()
        }
        if (rest.isNotBlank()) out += rest
    }
}
