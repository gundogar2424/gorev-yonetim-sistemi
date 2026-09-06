package com.seslipdf.app.ui

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.seslipdf.app.data.AppDatabase
import com.seslipdf.app.data.Doc
import com.seslipdf.app.data.DocStatus
import com.seslipdf.app.data.Prefs
import com.seslipdf.app.data.TextStore
import com.seslipdf.app.pdf.ExtractQueue
import com.seslipdf.app.tts.ReaderService
import com.seslipdf.app.tts.VoiceCatalog
import com.seslipdf.app.tts.VoiceInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LibraryViewModel(app: Application) : AndroidViewModel(app) {

    private val dao = AppDatabase.get(app).docDao()
    private val prefs = Prefs(app)

    val docs: StateFlow<List<Doc>> = dao.all()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val extracting = ExtractQueue.progress

    // --- ayarlar (Compose'un takip edebilmesi icin ayrica state olarak tutulur)

    var rate by mutableStateOf(prefs.rate)
        private set
    var pitch by mutableStateOf(prefs.pitch)
        private set
    var voice by mutableStateOf(prefs.voice)
        private set
    var language by mutableStateOf(prefs.language)
        private set
    var ocrFallback by mutableStateOf(prefs.ocrFallback)
        private set
    var stripHeads by mutableStateOf(prefs.stripRunningHeads)
        private set
    var keepAwake by mutableStateOf(prefs.keepAwake)
        private set
    var autoScroll by mutableStateOf(prefs.autoScroll)
        private set
    var scrollSpeed by mutableStateOf(prefs.scrollSpeed)
        private set
    var sleepMinutes by mutableStateOf(prefs.sleepMinutes)
        private set

    var voices by mutableStateOf<List<VoiceInfo>>(emptyList())
        private set
    var voicesLoading by mutableStateOf(false)
        private set

    /** Kutuphanede en son acilan belge (uygulama acilisinda okuma sekmesi icin). */
    val lastDocId: Long get() = prefs.lastDocId

    // ------------------------------------------------------------ kutuphane

    /**
     * Secilen PDF'i kutuphaneye ekler ve metnini cikarmaya baslar. Ayni dosya
     * daha once eklendiyse yeniden eklenmez, var olan kayit acilir.
     */
    fun addPdf(uri: Uri, onReady: (Long) -> Unit = {}) {
        viewModelScope.launch {
            val app = getApplication<Application>()
            val existing = dao.byUri(uri.toString())
            if (existing != null) {
                if (existing.status == DocStatus.FAILED || existing.status == DocStatus.PENDING) {
                    ExtractQueue.enqueue(app, existing.id)
                }
                onReady(existing.id)
                return@launch
            }
            val id = dao.insert(
                Doc(
                    uri = uri.toString(),
                    title = displayName(uri),
                    status = DocStatus.PENDING
                )
            )
            ExtractQueue.enqueue(app, id)
            onReady(id)
        }
    }

    /** Basarisiz ya da sifreli bir belgeyi (gerekirse parolayla) yeniden dener. */
    fun retry(doc: Doc, password: String = "") {
        ExtractQueue.enqueue(getApplication(), doc.id, password)
    }

    fun rename(doc: Doc, title: String) {
        viewModelScope.launch { dao.update(doc.copy(title = title.trim().ifBlank { doc.title })) }
    }

    fun delete(doc: Doc) {
        viewModelScope.launch {
            val app = getApplication<Application>()
            if (com.seslipdf.app.tts.ReaderState.status.value.docId == doc.id) {
                ReaderService.close(app)
            }
            dao.delete(doc)
            withContext(Dispatchers.IO) {
                TextStore.delete(app, doc.id)
                try {
                    app.contentResolver.releasePersistableUriPermission(
                        Uri.parse(doc.uri),
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                    )
                } catch (e: Exception) {
                    // Kalici izin alinmamis olabilir; onemli degil.
                }
            }
        }
    }

    /** Bastan okumak icin ilerlemeyi sifirlar. */
    fun restart(doc: Doc) {
        viewModelScope.launch {
            dao.setPosition(doc.id, 0)
            if (com.seslipdf.app.tts.ReaderState.status.value.docId == doc.id) {
                ReaderService.seek(getApplication(), 0)
            }
        }
    }

    private suspend fun displayName(uri: Uri): String = withContext(Dispatchers.IO) {
        val app = getApplication<Application>()
        val fromResolver = try {
            app.contentResolver.query(uri, null, null, null, null)?.use { c ->
                val index = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && c.moveToFirst()) c.getString(index) else null
            }
        } catch (e: Exception) {
            null
        }
        val raw = fromResolver ?: uri.lastPathSegment.orEmpty().substringAfterLast('/')
        raw.removeSuffix(".pdf").removeSuffix(".PDF").ifBlank { "Adsız belge" }
    }

    // -------------------------------------------------------------- ayarlar

    fun updateRate(value: Float) {
        rate = value
        prefs.rate = value
        ReaderService.refreshVoice(getApplication())
    }

    fun updatePitch(value: Float) {
        pitch = value
        prefs.pitch = value
        ReaderService.refreshVoice(getApplication())
    }

    fun updateVoice(info: VoiceInfo?) {
        voice = info?.name.orEmpty()
        prefs.voice = voice
        if (info != null) {
            language = info.localeTag
            prefs.language = info.localeTag
        }
        ReaderService.refreshVoice(getApplication())
    }

    fun updateLanguage(tag: String) {
        language = tag
        prefs.language = tag
        // Dil degisince eski ses gecersiz olur; sistem varsayilanina donulur.
        voice = ""
        prefs.voice = ""
        ReaderService.refreshVoice(getApplication())
    }

    fun updateOcrFallback(value: Boolean) {
        ocrFallback = value
        prefs.ocrFallback = value
    }

    fun updateStripHeads(value: Boolean) {
        stripHeads = value
        prefs.stripRunningHeads = value
    }

    fun updateKeepAwake(value: Boolean) {
        keepAwake = value
        prefs.keepAwake = value
    }

    fun updateAutoScroll(value: Boolean) {
        autoScroll = value
        prefs.autoScroll = value
    }

    fun updateScrollSpeed(value: Float) {
        scrollSpeed = value
        prefs.scrollSpeed = value
    }

    /** Bir cumleden digerine kayarken gecen sure (milisaniye). */
    val scrollMillis: Int
        get() = (SCROLL_SLOWEST - (SCROLL_SLOWEST - SCROLL_FASTEST) * scrollSpeed.coerceIn(0f, 1f)).toInt()

    fun updateSleepMinutes(value: Int) {
        sleepMinutes = value
        prefs.sleepMinutes = value
    }

    companion object {
        /** En yavas ve en hizli kayma sureleri (milisaniye). */
        const val SCROLL_SLOWEST = 2200f
        const val SCROLL_FASTEST = 250f
    }

    fun loadVoices() {
        if (voicesLoading || voices.isNotEmpty()) return
        voicesLoading = true
        viewModelScope.launch {
            voices = VoiceCatalog.load(getApplication())
            voicesLoading = false
        }
    }
}
