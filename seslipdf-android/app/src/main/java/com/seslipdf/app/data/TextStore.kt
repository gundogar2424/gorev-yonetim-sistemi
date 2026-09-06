package com.seslipdf.app.data

import android.content.Context
import java.io.File

/** Bir belgenin okunmaya hazir metni: cumleler + sayfa baslangiclari. */
data class DocText(
    val sentences: List<String>,
    /** pageStarts[i] = i. sayfanin ilk cumlesinin sirasi. */
    val pageStarts: List<Int>
) {
    /** Verilen cumle kacinci sayfada (1'den baslar). */
    fun pageOf(sentence: Int): Int {
        if (pageStarts.isEmpty()) return 1
        var page = 1
        for ((index, start) in pageStarts.withIndex()) {
            if (start <= sentence) page = index + 1 else break
        }
        return page
    }

    /** Sayfanin ilk cumlesi (sayfa 1'den baslar). */
    fun startOfPage(page: Int): Int =
        pageStarts.getOrNull(page - 1) ?: 0
}

/**
 * Cikarilan metin veritabaninda degil, uygulamanin kendi klasorunde tutulur —
 * kitap boyu metinler Room satirina sigmaz. Her cumle bir satirdir; cumlelerin
 * icindeki satir sonlari cikarma sirasinda bosluga cevrilir.
 */
object TextStore {

    private fun dir(context: Context) =
        File(context.filesDir, "docs").apply { mkdirs() }

    private fun textFile(context: Context, id: Long) = File(dir(context), "$id.txt")
    private fun pageFile(context: Context, id: Long) = File(dir(context), "$id.pages")

    fun save(context: Context, id: Long, sentences: List<String>, pageStarts: List<Int>) {
        textFile(context, id).writeText(sentences.joinToString("\n"))
        pageFile(context, id).writeText(pageStarts.joinToString(","))
    }

    fun load(context: Context, id: Long): DocText? {
        val file = textFile(context, id)
        if (!file.exists()) return null
        val sentences = file.readLines().filter { it.isNotBlank() }
        if (sentences.isEmpty()) return null
        val pages = pageFile(context, id)
            .takeIf { it.exists() }
            ?.readText()
            ?.split(",")
            ?.mapNotNull { it.trim().toIntOrNull() }
            ?: emptyList()
        return DocText(sentences, pages)
    }

    fun delete(context: Context, id: Long) {
        textFile(context, id).delete()
        pageFile(context, id).delete()
    }
}
