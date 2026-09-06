package com.otoara.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Tek bir arama denemesinin kaydi. */
@Entity(tableName = "attempts")
data class Attempt(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** Ayni turdeki denemeleri gruplayan kimlik (turun baslama zamani). */
    val sessionId: Long,
    val number: String,
    val label: String = "",
    /** Kacinci deneme (1'den baslar). */
    val tryNo: Int,
    val startedAt: Long,
    /** Cagri kac saniye acik kaldi. */
    val connectedSec: Int,
    /** Sonuc kodu — [AttemptResult] degerleri. */
    val result: String
)

object AttemptResult {
    const val ANSWERED = "answered"
    const val NO_ANSWER = "no_answer"
    const val NOT_CONNECTED = "not_connected"
    const val FAILED = "failed"
    const val CANCELLED = "cancelled"

    fun label(code: String) = when (code) {
        ANSWERED -> "Cevaplandı"
        NO_ANSWER -> "Cevap yok"
        NOT_CONNECTED -> "Bağlanamadı"
        CANCELLED -> "İptal edildi"
        else -> "Başarısız"
    }
}

/** Sik aranan / son aranan numaralar. */
@Entity(tableName = "targets")
data class Target(
    @PrimaryKey val number: String,
    val label: String = "",
    val lastUsedAt: Long = 0
)
