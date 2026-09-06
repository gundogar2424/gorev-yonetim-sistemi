package com.seslipdf.app.tts

import com.seslipdf.app.data.DocText
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Okuyucunun canli durumu. Servis yazar, ekran okur; boylece uygulama kapatilip
 * yeniden acilsa bile okumanin nerede oldugu gorunur.
 */
data class ReaderStatus(
    val docId: Long = 0,
    val title: String = "",
    /** Su an konusuluyor mu. */
    val playing: Boolean = false,
    /** Metin yukleniyor / ses motoru hazirlaniyor. */
    val loading: Boolean = false,
    /** Okunan cumlenin sirasi. */
    val index: Int = 0,
    val total: Int = 0,
    val page: Int = 0,
    val pageCount: Int = 0,
    /** Uyku sayacinin bitecegi an (SystemClock.elapsedRealtime); 0 = kapali. */
    val sleepAt: Long = 0,
    val error: String? = null
) {
    val progress: Float get() = if (total <= 0) 0f else (index.toFloat() / total).coerceIn(0f, 1f)
}

object ReaderState {

    private val _status = MutableStateFlow(ReaderStatus())
    val status: StateFlow<ReaderStatus> = _status

    /** Acik belgenin cumleleri — ekran bunlari listeler ve okunani vurgular. */
    private val _text = MutableStateFlow<DocText?>(null)
    val text: StateFlow<DocText?> = _text

    fun update(block: (ReaderStatus) -> ReaderStatus) {
        _status.value = block(_status.value)
    }

    fun set(status: ReaderStatus) {
        _status.value = status
    }

    fun setText(text: DocText?) {
        _text.value = text
    }

    fun clearError() {
        if (_status.value.error != null) _status.value = _status.value.copy(error = null)
    }
}
