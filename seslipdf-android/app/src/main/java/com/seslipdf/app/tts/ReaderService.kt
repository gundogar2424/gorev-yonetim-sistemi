package com.seslipdf.app.tts

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.seslipdf.app.MainActivity
import com.seslipdf.app.R
import com.seslipdf.app.data.AppDatabase
import com.seslipdf.app.data.DocText
import com.seslipdf.app.data.Prefs
import com.seslipdf.app.data.TextStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Metni sesli okuyan on plan servisi.
 *
 * Okuma cumle cumle yapilir: her cumle Android'in metin okuma (TTS) motoruna
 * ayri bir "utterance" olarak verilir, sirasi da kimlik olarak gecer. Boylece
 *
 *  - hangi cumlenin okundugu bilinir (ekranda vurgulanir),
 *  - kaldigi yer kaydedilir (uygulama kapansa da devam eder),
 *  - ileri/geri alma tam cumle basina gider.
 *
 * Akiciligi bozmamak icin motorun kuyrugunda her zaman bir sonraki cumle de
 * hazir bekletilir.
 */
class ReaderService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Tum durum degisiklikleri ana is parcaciginda yapilir (TTS geri cagrilari
     *  baska bir is parcacigindan gelir). */
    private val main = Handler(Looper.getMainLooper())

    private var tts: TextToSpeech? = null
    private var engineReady = false

    private var docId = 0L
    private var docTitle = ""
    private var docText: DocText? = null
    private val sentences: List<String> get() = docText?.sentences ?: emptyList()

    /** Su an okunan cumle. */
    private var current = 0

    /** Motora verilecek bir sonraki cumle. */
    private var nextToQueue = 0

    /** Motorun kuyrugunda bekleyen cumle sayisi. */
    private var pending = 0

    /** Kullanici okuma istiyor mu (duraklatinca false olur). */
    private var wantPlay = false

    /** Baska bir uygulama sesi aldigi icin duraklatildi mi. */
    private var pausedByFocus = false

    private var wakeLock: PowerManager.WakeLock? = null
    private var focusRequest: AudioFocusRequest? = null
    private var sleepJob: Job? = null
    private var foreground = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // startForegroundService ile gelindiyse 5 saniye icinde startForeground
        // cagrilmak zorunda.
        startForegroundSafely()

        when (intent?.action) {
            ACTION_OPEN -> {
                val id = intent.getLongExtra(EXTRA_DOC_ID, 0L)
                val autoPlay = intent.getBooleanExtra(EXTRA_AUTOPLAY, false)
                openDoc(id, autoPlay)
            }
            ACTION_PLAY -> doPlay()
            ACTION_PAUSE -> doPause()
            ACTION_TOGGLE -> if (wantPlay) doPause() else doPlay()
            ACTION_NEXT -> seekTo(current + 1, keepPlaying = true)
            ACTION_PREV -> seekTo(current - 1, keepPlaying = true)
            ACTION_SEEK -> seekTo(intent.getIntExtra(EXTRA_INDEX, 0), keepPlaying = true)
            ACTION_SETTINGS -> applyVoiceSettings()
            ACTION_SLEEP -> setSleepTimer(intent.getIntExtra(EXTRA_MINUTES, 0))
            ACTION_STOP -> {
                shutdown()
                return START_NOT_STICKY
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        sleepJob?.cancel()
        releaseFocus()
        releaseWakeLock()
        tts?.let {
            try { it.stop() } catch (e: Exception) { }
            it.shutdown()
        }
        tts = null
        scope.cancel()
        ReaderState.update { it.copy(playing = false, loading = false) }
        super.onDestroy()
    }

    // -------------------------------------------------------------- belge acma

    private fun openDoc(id: Long, autoPlay: Boolean) {
        if (id <= 0L) return
        if (id == docId && docText != null) {
            if (autoPlay) doPlay()
            return
        }

        stopSpeaking()
        docId = id
        docText = null
        current = 0
        nextToQueue = 0
        pending = 0
        wantPlay = false
        ReaderState.setText(null)
        ReaderState.set(ReaderStatus(docId = id, loading = true))

        scope.launch {
            val dao = AppDatabase.get(this@ReaderService).docDao()
            val doc = dao.byId(id)
            val text = TextStore.load(this@ReaderService, id)
            if (doc == null || text == null) {
                main.post {
                    ReaderState.update {
                        it.copy(loading = false, error = "Belgenin metni bulunamadı, yeniden ekleyin.")
                    }
                }
                return@launch
            }
            dao.touch(id, System.currentTimeMillis())
            Prefs(this@ReaderService).lastDocId = id

            main.post {
                docTitle = doc.title
                docText = text
                current = doc.position.coerceIn(0, text.sentences.lastIndex)
                nextToQueue = current
                ReaderState.setText(text)
                publish(loading = false)
                ensureEngine {
                    if (autoPlay) doPlay()
                }
            }
        }
    }

    // ------------------------------------------------------------- ses motoru

    /** TTS motorunu (gerekiyorsa) kurar; hazir oldugunda [then] calisir. */
    private fun ensureEngine(then: () -> Unit) {
        if (engineReady && tts != null) {
            then()
            return
        }
        if (tts != null) return   // kurulum suruyor
        ReaderState.update { it.copy(loading = true) }
        tts = TextToSpeech(applicationContext) { status ->
            main.post {
                if (status == TextToSpeech.SUCCESS) {
                    engineReady = true
                    tts?.setOnUtteranceProgressListener(progressListener)
                    applyVoiceSettings()
                    ReaderState.update { it.copy(loading = false) }
                    then()
                } else {
                    engineReady = false
                    ReaderState.update {
                        it.copy(
                            loading = false,
                            playing = false,
                            error = "Cihazda metin okuma (TTS) motoru bulunamadı. " +
                                "Play Store'dan \"Google Konuşma Hizmetleri\"ni kurun."
                        )
                    }
                }
            }
        }
    }

    /** Hiz, ton ve dil ayarlarini motora uygular. */
    private fun applyVoiceSettings() {
        val engine = tts ?: return
        if (!engineReady) return
        val prefs = Prefs(this)

        val locale = try {
            Locale.forLanguageTag(prefs.language.ifBlank { "tr-TR" })
        } catch (e: Exception) {
            Locale("tr", "TR")
        }
        val result = try { engine.setLanguage(locale) } catch (e: Exception) { TextToSpeech.LANG_NOT_SUPPORTED }
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            ReaderState.update {
                it.copy(
                    error = "Bu dil için ses paketi yok. Telefon Ayarları → Erişilebilirlik → " +
                        "Metin okuma bölümünden sesi indirebilirsiniz."
                )
            }
        }

        if (prefs.voice.isNotBlank()) {
            try {
                engine.voices?.firstOrNull { it.name == prefs.voice }?.let { engine.voice = it }
            } catch (e: Exception) {
                // Bazi motorlar ses listesini vermez; varsayilan ses kullanilir.
            }
        }
        engine.setSpeechRate(prefs.rate)
        engine.setPitch(prefs.pitch)

        // Hiz/ton degisikligi ancak yeni cumlede duyulur; okuma suruyorsa
        // bulunulan cumle bastan soylenir.
        if (wantPlay) seekTo(current, keepPlaying = true)
    }

    private val progressListener = object : UtteranceProgressListener() {

        override fun onStart(utteranceId: String?) {
            val index = utteranceId?.toIntOrNull() ?: return
            main.post {
                current = index
                publish()
                saveProgress()
            }
        }

        override fun onDone(utteranceId: String?) {
            main.post {
                pending = (pending - 1).coerceAtLeast(0)
                if (nextToQueue >= sentences.size && pending == 0) finishDoc() else pump()
            }
        }

        @Deprecated("Eski Android surumleri bu imzayi cagirir")
        override fun onError(utteranceId: String?) {
            main.post {
                pending = (pending - 1).coerceAtLeast(0)
                pump()
            }
        }

        override fun onError(utteranceId: String?, errorCode: Int) {
            onError(utteranceId)
        }
    }

    // ------------------------------------------------------------ oynat/durdur

    private fun doPlay() {
        if (sentences.isEmpty()) return
        if (!engineReady) {
            ensureEngine { doPlay() }
            return
        }
        if (!requestFocus()) {
            ReaderState.update { it.copy(error = "Ses başka bir uygulamada kullanılıyor.") }
            return
        }
        wantPlay = true
        pausedByFocus = false
        acquireWakeLock()
        if (current >= sentences.size) current = 0
        nextToQueue = current
        pending = 0
        try { tts?.stop() } catch (e: Exception) { }
        pump()
        publish()
    }

    private fun doPause() {
        wantPlay = false
        stopSpeaking()
        releaseFocus()
        releaseWakeLock()
        saveProgress()
        publish()
    }

    /** Motorun kuyrugunu bosaltir; okunan cumle korunur. */
    private fun stopSpeaking() {
        try { tts?.stop() } catch (e: Exception) { }
        pending = 0
        nextToQueue = current
    }

    /** Kuyrukta her zaman bir sonraki cumle de hazir bekler; boylece ara verilmez. */
    private fun pump() {
        val engine = tts ?: return
        if (!engineReady || !wantPlay) return
        while (pending < QUEUE_AHEAD && nextToQueue < sentences.size) {
            val index = nextToQueue
            val params = Bundle().apply {
                putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC)
            }
            val result = engine.speak(
                sentences[index],
                TextToSpeech.QUEUE_ADD,
                params,
                index.toString()
            )
            if (result != TextToSpeech.SUCCESS) break
            pending++
            nextToQueue++
        }
    }

    /** Belirli bir cumleye atlar. */
    private fun seekTo(index: Int, keepPlaying: Boolean) {
        if (sentences.isEmpty()) return
        val target = index.coerceIn(0, sentences.lastIndex)
        val wasPlaying = wantPlay
        stopSpeaking()
        current = target
        nextToQueue = target
        saveProgress()
        if (wasPlaying && keepPlaying) pump()
        publish()
    }

    private fun finishDoc() {
        wantPlay = false
        current = sentences.lastIndex.coerceAtLeast(0)
        releaseFocus()
        releaseWakeLock()
        saveProgress()
        publish()
    }

    private fun setSleepTimer(minutes: Int) {
        sleepJob?.cancel()
        if (minutes <= 0) {
            ReaderState.update { it.copy(sleepAt = 0) }
            return
        }
        val millis = minutes * 60_000L
        ReaderState.update { it.copy(sleepAt = SystemClock.elapsedRealtime() + millis) }
        sleepJob = scope.launch {
            delay(millis)
            main.post {
                doPause()
                ReaderState.update { it.copy(sleepAt = 0) }
            }
        }
    }

    private fun shutdown() {
        wantPlay = false
        stopSpeaking()
        saveProgress()
        ReaderState.set(ReaderStatus())
        ReaderState.setText(null)
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        foreground = false
        stopSelf()
    }

    // ------------------------------------------------------------------ durum

    private fun saveProgress() {
        val id = docId
        val index = current
        if (id <= 0L) return
        scope.launch {
            try {
                AppDatabase.get(this@ReaderService).docDao().setPosition(id, index)
            } catch (e: Exception) {
                // Kayit basarisiz olursa okuma yine de surer.
            }
        }
    }

    /** Durumu ekrana ve bildirime yansitir. */
    private fun publish(loading: Boolean? = null) {
        val text = docText
        val total = sentences.size
        ReaderState.update {
            it.copy(
                docId = docId,
                title = docTitle,
                playing = wantPlay,
                loading = loading ?: it.loading,
                index = current,
                total = total,
                page = text?.pageOf(current) ?: 0,
                pageCount = text?.pageStarts?.size ?: 0
            )
        }
        updateNotification()
    }

    // ------------------------------------------------------------- ses odagi

    private fun requestFocus(): Boolean {
        val am = getSystemService(AudioManager::class.java) ?: return true
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attrs)
            .setOnAudioFocusChangeListener { change ->
                main.post {
                    when (change) {
                        AudioManager.AUDIOFOCUS_LOSS -> { pausedByFocus = false; doPause() }
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                            if (wantPlay) { pausedByFocus = true; doPause() }
                        }
                        AudioManager.AUDIOFOCUS_GAIN -> if (pausedByFocus) { pausedByFocus = false; doPlay() }
                    }
                }
            }
            .build()
        focusRequest = request
        return am.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun releaseFocus() {
        val am = getSystemService(AudioManager::class.java) ?: return
        focusRequest?.let { am.abandonAudioFocusRequest(it) }
        focusRequest = null
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(PowerManager::class.java) ?: return
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SesliPdf:okuma").apply {
            setReferenceCounted(false)
            // Guvenlik icin ust sinir: unutulup pil tuketmesin.
            acquire(4 * 60 * 60 * 1000L)
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (e: Exception) {
            // Zaten birakilmis olabilir.
        }
        wakeLock = null
    }

    // ------------------------------------------------------------- bildirim

    private fun startForegroundSafely() {
        if (foreground) return
        try {
            ServiceCompat.startForeground(
                this,
                NOTIF_ID,
                buildNotification(),
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
            )
            foreground = true
        } catch (e: Exception) {
            // Bildirim izni yoksa da servis calismaya devam eder.
        }
    }

    private fun updateNotification() {
        if (!foreground) return
        try {
            NotificationManagerCompat.from(this).notify(NOTIF_ID, buildNotification())
        } catch (e: SecurityException) {
            // Bildirim izni verilmemis; sessizce gec.
        }
    }

    private fun buildNotification(): android.app.Notification {
        val total = sentences.size
        val text = docText
        val page = text?.pageOf(current) ?: 0
        val pageCount = text?.pageStarts?.size ?: 0
        val percent = if (total > 0) (current * 100 / total) else 0

        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_OPEN_DOC, docId)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(docTitle.ifBlank { getString(R.string.app_name) })
            .setContentText(
                if (pageCount > 0) "Sayfa $page / $pageCount  ·  %$percent"
                else "Hazırlanıyor…"
            )
            .setContentIntent(open)
            .setOngoing(wantPlay)
            .setSilent(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        if (total > 0) builder.setProgress(total, current, false)

        builder.addAction(
            R.drawable.ic_prev, "Geri", actionIntent(ACTION_PREV, 1)
        )
        builder.addAction(
            if (wantPlay) R.drawable.ic_pause else R.drawable.ic_play,
            if (wantPlay) "Duraklat" else "Oku",
            actionIntent(ACTION_TOGGLE, 2)
        )
        builder.addAction(
            R.drawable.ic_next, "İleri", actionIntent(ACTION_NEXT, 3)
        )
        builder.addAction(
            R.drawable.ic_close, "Kapat", actionIntent(ACTION_STOP, 4)
        )
        return builder.build()
    }

    private fun actionIntent(action: String, code: Int): PendingIntent =
        PendingIntent.getBroadcast(
            this, code,
            Intent(this, ReaderActionReceiver::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    companion object {
        const val ACTION_OPEN = "com.seslipdf.app.action.OPEN"
        const val ACTION_PLAY = "com.seslipdf.app.action.PLAY"
        const val ACTION_PAUSE = "com.seslipdf.app.action.PAUSE"
        const val ACTION_TOGGLE = "com.seslipdf.app.action.TOGGLE"
        const val ACTION_NEXT = "com.seslipdf.app.action.NEXT"
        const val ACTION_PREV = "com.seslipdf.app.action.PREV"
        const val ACTION_SEEK = "com.seslipdf.app.action.SEEK"
        const val ACTION_SETTINGS = "com.seslipdf.app.action.SETTINGS"
        const val ACTION_SLEEP = "com.seslipdf.app.action.SLEEP"
        const val ACTION_STOP = "com.seslipdf.app.action.STOP"

        private const val EXTRA_DOC_ID = "docId"
        private const val EXTRA_AUTOPLAY = "autoPlay"
        private const val EXTRA_INDEX = "index"
        private const val EXTRA_MINUTES = "minutes"

        private const val CHANNEL = "reading"
        private const val NOTIF_ID = 41
        /** Motor kuyrugunda kac cumle bekletilsin (akici gecis icin). */
        private const val QUEUE_AHEAD = 2

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL, "Sesli okuma", NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Okuma sürerken görünen kumanda bildirimi"
                    setShowBadge(false)
                }
            )
        }

        fun open(context: Context, docId: Long, autoPlay: Boolean = false) =
            send(context, ACTION_OPEN) {
                putExtra(EXTRA_DOC_ID, docId)
                putExtra(EXTRA_AUTOPLAY, autoPlay)
            }

        fun play(context: Context) = send(context, ACTION_PLAY)
        fun pause(context: Context) = send(context, ACTION_PAUSE)
        fun toggle(context: Context) = send(context, ACTION_TOGGLE)
        fun next(context: Context) = send(context, ACTION_NEXT)
        fun previous(context: Context) = send(context, ACTION_PREV)
        fun seek(context: Context, index: Int) = send(context, ACTION_SEEK) {
            putExtra(EXTRA_INDEX, index)
        }
        fun refreshVoice(context: Context) = send(context, ACTION_SETTINGS)
        fun sleepTimer(context: Context, minutes: Int) = send(context, ACTION_SLEEP) {
            putExtra(EXTRA_MINUTES, minutes)
        }
        fun close(context: Context) = send(context, ACTION_STOP)

        private fun send(context: Context, action: String, block: Intent.() -> Unit = {}) {
            val intent = Intent(context, ReaderService::class.java).setAction(action).apply(block)
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                // Uygulama arka planda ve servis calismiyorsa Android baslatmayi
                // reddedebilir; kullanici ekrani acinca yeniden denenir.
            }
        }
    }
}
