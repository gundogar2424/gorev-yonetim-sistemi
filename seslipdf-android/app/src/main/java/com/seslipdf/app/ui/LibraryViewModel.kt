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
    var silentMode by mutableStateOf(prefs.silentMode)
        private set
    var flowSpeed by mutableStateOf(prefs.flowSpeed)
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

    fun updateSilentMode(value: Boolean) {
        silentMode = value
        prefs.silentMode = value
    }

    /** [persist] = false: kaydirac surukleneriken yalnizca ekrandaki deger degisir. */
    fun updateFlowSpeed(value: Float, persist: Boolean = true) {
        flowSpeed = value.coerceIn(0f, 1f)
        if (persist) prefs.flowSpeed = flowSpeed
    }

    /** Sessiz modda akisin hizi (piksel/saniye). */
    val flowPixelsPerSecond: Float
        get() = FLOW_MIN + (FLOW_MAX - FLOW_MIN) * flowSpeed.coerceIn(0f, 1f).let { it * it }

    /** Kullaniciya gosterilen 1-10 arasi hiz kademesi. */
    val flowStep: Int
        get() = (flowSpeed * 9f).toInt() + 1

    fun updateScrollSpeed(value: Float) {
        scrollSpeed = value
        prefs.scrollSpeed = value
    }

    /**
     * Akisin okunan cumleyi ne kadar sikica takip ettigi (1/saniye). Kucuk deger
     * = cok yumusak, agir agir suzulen bir akis; buyuk deger = hemen yerine oturur.
     */
    val scrollGain: Float
        get() = GAIN_MIN + (GAIN_MAX - GAIN_MIN) * scrollSpeed.coerceIn(0f, 1f).let { it * it }

    fun updateSleepMinutes(value: Int) {
        sleepMinutes = value
        prefs.sleepMinutes = value
    }

    companion object {
        /** Akisin en yumusak ve en keskin takip degerleri. */
        const val GAIN_MIN = 0.35f
        const val GAIN_MAX = 8f

        /** Sessiz moddaki en yavas ve en hizli akis (piksel/saniye). */
        const val FLOW_MIN = 5f
        const val FLOW_MAX = 150f
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
