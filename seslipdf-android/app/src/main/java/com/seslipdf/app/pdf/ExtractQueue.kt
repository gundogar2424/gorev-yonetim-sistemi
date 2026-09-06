package com.seslipdf.app.pdf

import android.content.Context
import android.net.Uri
import com.seslipdf.app.data.AppDatabase
import com.seslipdf.app.data.DocStatus
import com.seslipdf.app.data.Prefs
import com.seslipdf.app.data.TextStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Eklenen PDF'lerin metnini sirayla cikarir. Ayni anda tek belge islenir; bir
 * kitabin cikarilmasi telefonu yormasin diye kuyruk kullanilir.
 *
 * Islem uygulama acikken surer. Kullanici uygulamadan cikip sistem uygulamayi
 * kapatirsa belge "Sırada" olarak kalir ve kutuphaneden tek dokunusla yeniden
 * baslatilabilir.
 */
object ExtractQueue {

    /** O an islenen belgenin durumu (ekranda yuzde olarak gosterilir). */
    data class Progress(
        val docId: Long,
        val page: Int,
        val total: Int,
        val ocr: Boolean
    ) {
        val ratio: Float get() = if (total <= 0) 0f else (page.toFloat() / total).coerceIn(0f, 1f)
    }

    private val _progress = MutableStateFlow<Progress?>(null)
    val progress: StateFlow<Progress?> = _progress

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()

    /** Belgeyi kuyruga alir. [password] yalnizca sifreli PDF'ler icin gerekir. */
    fun enqueue(context: Context, docId: Long, password: String = "") {
        val app = context.applicationContext
        scope.launch { runOne(app, docId, password) }
    }

    private suspend fun runOne(context: Context, docId: Long, password: String) =
        mutex.withLock {
            val dao = AppDatabase.get(context).docDao()
            val doc = dao.byId(docId) ?: return@withLock
            val prefs = Prefs(context)

            dao.setStatus(docId, DocStatus.WORKING, "")
            _progress.value = Progress(docId, 0, doc.pageCount, false)

            try {
                val result = PdfExtractor.extract(
                    context = context,
                    uri = Uri.parse(doc.uri),
                    password = password,
                    ocrFallback = prefs.ocrFallback,
                    stripHeads = prefs.stripRunningHeads
                ) { page, total, ocr ->
                    _progress.value = Progress(docId, page, total, ocr)
                }

                // Sayfa sayfa cumlelere ayrilir; her sayfanin ilk cumlesi
                // isaretlenir ki okurken "Sayfa 12 / 340" gosterilebilsin.
                val sentences = mutableListOf<String>()
                val pageStarts = mutableListOf<Int>()
                result.pages.forEach { page ->
                    pageStarts += sentences.size
                    sentences += TextCleaner.splitSentences(page)
                }

                if (sentences.isEmpty()) {
                    dao.setStatus(
                        docId, DocStatus.FAILED,
                        "Bu PDF'te okunabilir metin bulunamadı. Taranmış bir belge ise " +
                            "Ayarlar'dan OCR'ı açıp yeniden deneyin."
                    )
                    return@withLock
                }

                TextStore.save(context, docId, sentences, pageStarts)

                val note = when {
                    result.ocrPages == 0 -> ""
                    else -> "${result.ocrPages} sayfa OCR ile okundu"
                }
                dao.update(
                    doc.copy(
                        pageCount = result.pageCount,
                        sentenceCount = sentences.size,
                        charCount = sentences.sumOf { it.length },
                        source = result.source,
                        status = DocStatus.READY,
                        note = note,
                        position = doc.position.coerceIn(0, sentences.size - 1)
                    )
                )
            } catch (e: PdfPasswordException) {
                dao.setStatus(
                    docId, DocStatus.LOCKED,
                    "Bu PDF parola ile korunuyor. Açmak için parolayı girin."
                )
            } catch (e: OutOfMemoryError) {
                dao.setStatus(
                    docId, DocStatus.FAILED,
                    "Belge telefonun belleği için fazla büyük. Ayarlar'dan OCR'ı kapatıp deneyin."
                )
            } catch (e: Exception) {
                dao.setStatus(
                    docId, DocStatus.FAILED,
                    e.message?.takeIf { it.isNotBlank() } ?: "PDF okunamadı"
                )
            } finally {
                _progress.value = null
            }
        }
}
