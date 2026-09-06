package com.seslipdf.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Kutuphaneye eklenen bir PDF. Dosyanin kendisi kopyalanmaz; yalnizca
 * kalici okuma izni alinmis SAF adresi (uri) saklanir. Cikarilan metin
 * ise [TextStore] tarafindan uygulamanin kendi klasorune yazilir.
 */
@Entity(tableName = "docs")
data class Doc(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val uri: String,
    val title: String,
    val pageCount: Int = 0,
    val sentenceCount: Int = 0,
    val charCount: Int = 0,
    val addedAt: Long = System.currentTimeMillis(),
    val lastOpenedAt: Long = 0,
    /** Okumada kalinan cumlenin sirasi (0'dan baslar). */
    val position: Int = 0,
    /** Metnin nereden geldigi — [DocSource] degerleri. */
    val source: String = DocSource.TEXT,
    /** Isleme durumu — [DocStatus] degerleri. */
    val status: String = DocStatus.PENDING,
    /** Hata/uyari mesaji (varsa kullaniciya gosterilir). */
    val note: String = ""
) {
    /** Okunan kisim (0..1). */
    val progress: Float
        get() = if (sentenceCount <= 0) 0f else (position.toFloat() / sentenceCount).coerceIn(0f, 1f)

    val ready: Boolean get() = status == DocStatus.READY && sentenceCount > 0
}

object DocStatus {
    /** Yeni eklendi, metni henuz cikarilmadi. */
    const val PENDING = "pending"
    /** Metin cikariliyor. */
    const val WORKING = "working"
    /** Okumaya hazir. */
    const val READY = "ready"
    /** PDF sifreli; kullanicidan parola bekleniyor. */
    const val LOCKED = "locked"
    /** Cikarma basarisiz oldu. */
    const val FAILED = "failed"

    fun label(code: String) = when (code) {
        PENDING -> "Sırada"
        WORKING -> "İşleniyor"
        READY -> "Hazır"
        LOCKED -> "Parola gerekli"
        else -> "Okunamadı"
    }
}

object DocSource {
    /** PDF'in kendi metin katmanindan okundu. */
    const val TEXT = "text"
    /** Sayfalar goruntu olarak taranip OCR ile okundu. */
    const val OCR = "ocr"
    /** Bir kismi metin katmanindan, bir kismi OCR'dan. */
    const val MIXED = "mixed"

    fun label(code: String) = when (code) {
        OCR -> "OCR ile okundu"
        MIXED -> "Metin + OCR"
        else -> "Metin katmanı"
    }
}
