package com.seslipdf.app.pdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.seslipdf.app.data.DocSource
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

/** PDF sifreli; kullanicidan parola istenmeli. */
class PdfPasswordException : Exception("PDF parola ile korunuyor")

/** Cikarma sonucu. */
data class Extracted(
    /** Temizlenmis sayfa metinleri (sirasiyla). */
    val pages: List<String>,
    val pageCount: Int,
    /** Metnin nereden geldigi — [DocSource]. */
    val source: String,
    /** Kac sayfa OCR ile okundu. */
    val ocrPages: Int
)

/**
 * PDF'in metnini cikarir. Her sey cihaz icinde olur; internet gerekmez.
 *
 * 1. Once PDF'in kendi **metin katmani** okunur (PDFBox). Bilgisayarda uretilmis
 *    PDF'lerin neredeyse tamaminda bu katman vardir ve en dogru sonucu verir.
 * 2. Bir sayfa bos geliyorsa (taranmis/fotograflanmis kitap), sayfa goruntuye
 *    cevrilip **OCR** ile okunur (ML Kit, cihaz ici).
 */
object PdfExtractor {

    /** Metin katmani bu kadar karakterden azsa sayfa "bos" (taranmis) sayilir. */
    private const val MIN_TEXT_PER_PAGE = 24

    /** OCR icin sayfa bu cozunurlukte cizilir. */
    private const val OCR_DPI = 200f
    private const val OCR_MAX_PIXELS = 2600

    suspend fun extract(
        context: Context,
        uri: Uri,
        password: String = "",
        ocrFallback: Boolean = true,
        stripHeads: Boolean = true,
        onProgress: (page: Int, total: Int, ocr: Boolean) -> Unit = { _, _, _ -> }
    ): Extracted {
        val cache = copyToCache(context, uri)
        try {
            val rawPages = mutableListOf<String>()
            var pageCount = 0

            PDDocument.load(cache, password).use { doc ->
                pageCount = doc.numberOfPages
                val stripper = PDFTextStripper()
                stripper.sortByPosition = true
                for (page in 1..pageCount) {
                    stripper.startPage = page
                    stripper.endPage = page
                    val text = try {
                        stripper.getText(doc)
                    } catch (e: Exception) {
                        // Tek bir bozuk sayfa tum kitabi engellemesin.
                        ""
                    }
                    rawPages += text
                    onProgress(page, pageCount, false)
                }
            }

            var ocrPages = 0
            val needsOcr = rawPages.withIndex()
                .filter { (_, text) -> text.trim().length < MIN_TEXT_PER_PAGE }
                .map { it.index }

            if (ocrFallback && needsOcr.isNotEmpty()) {
                ocrPages = runOcr(cache, needsOcr, rawPages) { done ->
                    onProgress(done, needsOcr.size, true)
                }
            }

            val cleaned = rawPages.map { TextCleaner.cleanPage(it) }
            val finalPages =
                if (stripHeads) TextCleaner.stripRunningHeads(cleaned) else cleaned

            val source = when {
                ocrPages == 0 -> DocSource.TEXT
                ocrPages >= pageCount -> DocSource.OCR
                else -> DocSource.MIXED
            }
            return Extracted(finalPages, pageCount, source, ocrPages)
        } catch (e: InvalidPasswordException) {
            throw PdfPasswordException()
        } finally {
            cache.delete()
        }
    }

    /**
     * Metin katmani olmayan sayfalari goruntuye cevirip OCR ile okur.
     * Sonuclari dogrudan [pages] listesine yazar; okunan sayfa sayisini dondurur.
     */
    private fun runOcr(
        file: File,
        indexes: List<Int>,
        pages: MutableList<String>,
        onProgress: (done: Int) -> Unit
    ): Int {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        var done = 0
        var read = 0
        try {
            ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
                PdfRenderer(pfd).use { renderer ->
                    for (index in indexes) {
                        if (index >= renderer.pageCount) continue
                        val text = try {
                            renderer.openPage(index).use { page ->
                                val bitmap = renderPage(page)
                                try {
                                    val task = recognizer.process(InputImage.fromBitmap(bitmap, 0))
                                    Tasks.await(task, 120, TimeUnit.SECONDS).text
                                } finally {
                                    bitmap.recycle()
                                }
                            }
                        } catch (e: Exception) {
                            ""   // sayfa okunamadi; digerlerine devam
                        }
                        if (text.isNotBlank()) {
                            pages[index] = text
                            read++
                        }
                        done++
                        onProgress(done)
                    }
                }
            }
        } catch (e: Exception) {
            // Sifreli ya da PdfRenderer'in acamadigi dosya: OCR'siz devam edilir.
        } finally {
            recognizer.close()
        }
        return read
    }

    private fun renderPage(page: PdfRenderer.Page): Bitmap {
        val scale = min(
            OCR_DPI / 72f,
            OCR_MAX_PIXELS / max(page.width, page.height).toFloat()
        ).coerceAtLeast(1f)
        val width = (page.width * scale).toInt().coerceAtLeast(1)
        val height = (page.height * scale).toInt().coerceAtLeast(1)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        // OCR beyaz zemin bekler; saydam alanlar siyah gorunmesin.
        bitmap.eraseColor(Color.WHITE)
        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        return bitmap
    }

    /**
     * SAF adresindeki PDF'i gecici bir dosyaya kopyalar. PDFBox'in dosya uzerinden
     * calismasi bellek acisindan cok daha ucuz; PdfRenderer ise zaten dosya
     * tanimlayicisi ister.
     */
    private fun copyToCache(context: Context, uri: Uri): File {
        val file = File.createTempFile("pdf", ".pdf", context.cacheDir)
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "PDF açılamadı" }
            file.outputStream().use { output -> input.copyTo(output, 64 * 1024) }
        }
        return file
    }

    /** Dosyanin kac sayfa oldugunu (varsa) hizlica soyler. */
    fun pageCountOrZero(context: Context, uri: Uri): Int = try {
        context.contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
            PdfRenderer(pfd).use { it.pageCount }
        } ?: 0
    } catch (e: Exception) {
        0
    }
}
