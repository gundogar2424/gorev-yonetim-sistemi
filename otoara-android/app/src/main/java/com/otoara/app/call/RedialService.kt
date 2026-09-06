package com.otoara.app.call

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.otoara.app.MainActivity
import com.otoara.app.R
import com.otoara.app.data.AppDatabase
import com.otoara.app.data.Attempt
import com.otoara.app.data.AttemptResult
import com.otoara.app.data.RedialConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Tekrar arama dongusunu yuruten on plan servisi.
 *
 * Ekran kapaliyken de calisir: kalici bir bildirim gosterir ve kismi wake-lock
 * tutar. Dongu su sekilde isler:
 *
 *  1. Numara aranir.
 *  2. Cagri kurulunca "cagri suresi" kadar beklenir; sure dolarsa cagri kapatilir.
 *  3. Cagri bittikten sonra arama kaydina bakilir: konusma suresi 0'dan buyukse
 *     cagri **cevaplanmistir** ve (secilmisse) dongu durur.
 *  4. Aksi halde "aralik" kadar beklenip tekrar aranir; tekrar sayisi dolana kadar.
 */
class RedialService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var job: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null

    /** Dongu suruyor mu. finish() ile kapanir; donguler bunu kontrol eder. */
    @Volatile private var active = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            // startForegroundService ile gelindiyse 5 sn icinde startForeground
            // cagrilmak zorunda; once ona uyup sonra kapaniyoruz.
            ensureChannels(this)
            startForegroundSafely(
                buildRunningNotification(RedialState.status.value.number, "Durduruluyor…", 0, 0)
            )
            finish("Durduruldu")
            return START_NOT_STICKY
        }

        val cfg = intent?.toConfig()
        if (cfg == null || cfg.number.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }
        val label = intent.getStringExtra(EXTRA_LABEL).orEmpty()

        ensureChannels(this)
        startForegroundSafely(
            buildRunningNotification(cfg.number, "Başlatılıyor…", 0, cfg.repeats)
        )
        acquireWakeLock(cfg)

        RedialState.set(
            RedialStatus(
                running = true,
                number = cfg.number,
                total = cfg.repeats,
                phase = Phase.DIALING
            )
        )

        job?.cancel()
        active = true
        job = scope.launch { runLoop(cfg, label) }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        active = false
        job?.cancel()
        scope.cancel()
        releaseWakeLock()
        if (RedialState.status.value.running) {
            RedialState.update { it.copy(running = false, phase = Phase.FINISHED) }
        }
        super.onDestroy()
    }

    // ---------------------------------------------------------------- dongu

    private suspend fun runLoop(cfg: RedialConfig, label: String) {
        val dao = AppDatabase.get(this).attemptDao()
        val sessionId = System.currentTimeMillis()
        var reason = "Tekrar sayısı tamamlandı"
        var answered = false

        for (tryNo in 1..cfg.repeats) {
            if (!active) return

            // Kullanici kendi gorusmesini yapiyorsa dongu bekler; onun
            // cagrisina kesinlikle dokunulmaz.
            if (!awaitFreeLine(cfg, tryNo)) {
                reason = "Telefon uzun süre meşgul kaldı"
                break
            }

            RedialState.update {
                it.copy(tryNo = tryNo, phase = Phase.DIALING, secondsLeft = 0, lastResult = null)
            }
            updateNotification(cfg.number, "Aranıyor…", tryNo, cfg.repeats)

            val outcome = runAttempt(cfg, tryNo)

            dao.insert(
                Attempt(
                    sessionId = sessionId,
                    number = cfg.number,
                    label = label,
                    tryNo = tryNo,
                    startedAt = outcome.startedAt,
                    connectedSec = outcome.connectedSec,
                    result = outcome.result
                )
            )
            RedialState.update { it.copy(lastResult = outcome.result) }

            if (outcome.result == AttemptResult.FAILED) {
                reason = "Arama başlatılamadı — izinleri kontrol edin"
                break
            }
            if (outcome.result == AttemptResult.ANSWERED && cfg.stopWhenAnswered) {
                answered = true
                reason = "Cevaplandı"
                break
            }
            if (tryNo == cfg.repeats) break

            // Bir sonraki aramaya kadar geri sayim. Kullanici bu sirada kendi
            // gorusmesine baslarsa sayac durur, bitince kaldigi yerden devam eder.
            RedialState.update { it.copy(phase = Phase.WAITING) }
            var left = cfg.intervalSec
            while (active && left > 0) {
                if (lineBusy()) {
                    RedialState.update { it.copy(phase = Phase.PAUSED, secondsLeft = 0) }
                    updateNotification(
                        cfg.number, "Telefonunuz meşgul — bekleniyor", tryNo, cfg.repeats
                    )
                    delay(1000)
                    continue
                }
                RedialState.update { it.copy(phase = Phase.WAITING, secondsLeft = left) }
                updateNotification(
                    cfg.number, "Sonraki arama $left sn sonra", tryNo, cfg.repeats
                )
                delay(1000)
                left--
            }
            if (!active) return
        }

        finish(reason, alert = true, answered = answered)
    }

    private class Outcome(
        val startedAt: Long,
        val connectedSec: Int,
        val result: String
    )

    private suspend fun runAttempt(cfg: RedialConfig, tryNo: Int): Outcome {
        val startedAt = System.currentTimeMillis()
        val monitoring = Phone.canReadState(this)

        if (!Phone.place(this, cfg.dialString())) {
            return Outcome(startedAt, 0, AttemptResult.FAILED)
        }

        // 1) Cagri kuruluyor mu?
        val connected = if (monitoring) {
            awaitState(TelephonyManager.CALL_STATE_OFFHOOK, 15_000)
        } else {
            delay(3000)
            true // durumu izleyemiyoruz; kuruldugunu varsayiyoruz
        }
        if (!connected) {
            return Outcome(startedAt, 0, AttemptResult.NOT_CONNECTED)
        }

        // 2) Cagri suresi boyunca bekle.
        RedialState.update { it.copy(phase = Phase.IN_CALL) }
        if (cfg.speaker) enableSpeaker()
        val connectStart = SystemClock.elapsedRealtime()
        val deadline = connectStart + cfg.ringSec * 1000L
        var weHungUp = false

        while (active) {
            val now = SystemClock.elapsedRealtime()
            if (monitoring && Phone.callState(this) == TelephonyManager.CALL_STATE_IDLE) break
            if (now >= deadline) {
                // Sadece BIZIM baslattigimiz, o an hala suren cagri kapatilir.
                // Kullanici bu arada kendi aramasini baslatmis olabilir; onun
                // gorusmesi asla kesilmez (durumu okuyamiyorsak da dokunmayiz).
                val stillOurCall = monitoring &&
                    Phone.callState(this) == TelephonyManager.CALL_STATE_OFFHOOK
                if (cfg.hangUpOnTimeout && stillOurCall && Phone.hangUp(this)) {
                    weHungUp = true
                    awaitState(TelephonyManager.CALL_STATE_IDLE, 6000)
                }
                break
            }
            val left = ((deadline - now) / 1000).toInt() + 1
            RedialState.update { it.copy(secondsLeft = left) }
            updateNotification(cfg.number, "Görüşmede — $left sn", tryNo, cfg.repeats)
            delay(400)
        }

        val connectedSec = ((SystemClock.elapsedRealtime() - connectStart) / 1000).toInt()

        // Cagrinin tamamen kapanmasini bekle (kullanici elle kapatmis olabilir).
        if (monitoring) awaitState(TelephonyManager.CALL_STATE_IDLE, 10_000)

        // 3) Cevaplandi mi? Once arama kaydi (guvenilir), yoksa sure tahmini.
        delay(1500)
        // Cagri bittiyse ses yolunu telefonun kendi secimine geri birak.
        if (cfg.speaker && Phone.callState(this) == TelephonyManager.CALL_STATE_IDLE) {
            Speaker.off(this)
        }
        val logged = Phone.lastOutgoingDuration(this, cfg.number)
        val answered = when {
            logged != null -> logged > 0
            // Izin yoksa: cagri kendi kendine kapandiysa ve yeterince uzun
            // surduyse cevaplanmis kabul edilir.
            else -> !weHungUp && connectedSec >= ANSWER_GUESS_SEC
        }

        return Outcome(
            startedAt = startedAt,
            connectedSec = connectedSec,
            result = if (answered) AttemptResult.ANSWERED else AttemptResult.NO_ANSWER
        )
    }

    /**
     * Hoparloru acar. Cagri kurulduktan hemen sonra ses yolu her zaman hazir
     * olmadigi icin kisa araliklarla birkac kez denenir.
     */
    private suspend fun enableSpeaker() {
        repeat(4) {
            if (!active) return
            if (Speaker.on(this) || Speaker.isOn(this)) return
            delay(700)
        }
    }

    /** Belirtilen cagri durumuna gecilene kadar bekler. */
    private suspend fun awaitState(target: Int, timeoutMs: Long): Boolean {
        if (!Phone.canReadState(this)) return false
        val end = SystemClock.elapsedRealtime() + timeoutMs
        while (SystemClock.elapsedRealtime() < end) {
            if (Phone.callState(this) == target) return true
            delay(250)
        }
        return false
    }

    /** Telefon su an baska bir cagriyla mi mesgul (gelen cagri dahil). */
    private fun lineBusy(): Boolean =
        Phone.canReadState(this) &&
            Phone.callState(this) != TelephonyManager.CALL_STATE_IDLE

    /**
     * Hat bosalana kadar bekler.
     *
     * Kullanici bu sirada kendi aramasini yapiyorsa (ya da gelen bir cagriyi
     * konusuyorsa) dongu **durmaz, duraklar**: ne yeni arama baslatilir ne de
     * suren cagriya dokunulur. Gorusme bittikten sonra kisa bir nefes payi
     * birakilip devam edilir.
     *
     * Cok uzun surerse (bkz. [MAX_BUSY_WAIT_MS]) dongu sonlandirilir.
     */
    private suspend fun awaitFreeLine(cfg: RedialConfig, tryNo: Int): Boolean {
        if (!Phone.canReadState(this)) return true
        if (Phone.callState(this) == TelephonyManager.CALL_STATE_IDLE) return true

        RedialState.update { it.copy(phase = Phase.PAUSED, secondsLeft = 0) }
        val end = SystemClock.elapsedRealtime() + MAX_BUSY_WAIT_MS

        while (active && SystemClock.elapsedRealtime() < end) {
            if (Phone.callState(this) == TelephonyManager.CALL_STATE_IDLE) {
                // Gorusme yeni bitti; hemen ustune arama yapma.
                delay(FREE_LINE_GRACE_MS)
                if (!active) return false
                if (Phone.callState(this) != TelephonyManager.CALL_STATE_IDLE) continue
                RedialState.update { it.copy(phase = Phase.DIALING) }
                return true
            }
            updateNotification(
                cfg.number, "Telefonunuz meşgul — bekleniyor", tryNo, cfg.repeats
            )
            delay(1000)
        }
        return false
    }

    // --------------------------------------------------------------- bitiris

    private fun finish(reason: String, alert: Boolean = false, answered: Boolean = false) {
        active = false
        job?.cancel()
        RedialState.update {
            it.copy(running = false, phase = Phase.FINISHED, secondsLeft = 0, finishedReason = reason)
        }
        if (alert) postResultNotification(reason, answered)
        // Gorusme surmuyorsa hoparloru birak; cevaplandiysa konusma devam
        // ettigi icin ses yoluna dokunulmaz.
        if (Phone.callState(this) == TelephonyManager.CALL_STATE_IDLE) Speaker.off(this)
        releaseWakeLock()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // ------------------------------------------------------------ bildirim

    private fun startForegroundSafely(notification: android.app.Notification) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIF_ID, notification, type)
    }

    private fun buildRunningNotification(
        number: String,
        text: String,
        tryNo: Int,
        total: Int
    ): android.app.Notification {
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getBroadcast(
            this, 1,
            Intent(this, StopReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val title = if (tryNo > 0) "$number  •  $tryNo/$total" else number
        return NotificationCompat.Builder(this, CHANNEL_RUN)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(open)
            .addAction(0, "Durdur", stop)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .build()
    }

    private fun updateNotification(number: String, text: String, tryNo: Int, total: Int) {
        val nm = NotificationManagerCompat.from(this)
        try {
            nm.notify(NOTIF_ID, buildRunningNotification(number, text, tryNo, total))
        } catch (e: SecurityException) {
            // Bildirim izni yoksa sessizce gec; dongu calismaya devam eder.
        }
    }

    private fun postResultNotification(reason: String, answered: Boolean) {
        val open = PendingIntent.getActivity(
            this, 2,
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(this, CHANNEL_DONE)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(if (answered) "Cevaplandı ✅" else "Tekrar arama bitti")
            .setContentText(reason)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        try {
            NotificationManagerCompat.from(this).notify(DONE_ID, n)
        } catch (e: SecurityException) {
            // izin yok
        }
    }

    // ------------------------------------------------------------ wake lock

    private fun acquireWakeLock(cfg: RedialConfig) {
        releaseWakeLock()
        val pm = getSystemService(PowerManager::class.java) ?: return
        // Dongunun kabaca surecegi sure + pay.
        val budget = (cfg.repeats.toLong() * (cfg.intervalSec + cfg.ringSec + 20) * 1000L) + 60_000L
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "otoara:redial").apply {
            setReferenceCounted(false)
            acquire(budget.coerceAtMost(4 * 60 * 60 * 1000L))
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.takeIf { it.isHeld }?.release()
        } catch (e: Exception) {
            // yoksay
        }
        wakeLock = null
    }

    companion object {
        const val ACTION_STOP = "com.otoara.app.action.STOP"
        const val CHANNEL_RUN = "redial_running"
        const val CHANNEL_DONE = "redial_done"
        private const val NOTIF_ID = 41
        private const val DONE_ID = 42

        /** Arama kaydi izni yokken "cevaplandi" tahmini icin esik (saniye). */
        private const val ANSWER_GUESS_SEC = 20

        /** Kullanicinin kendi gorusmesi icin en fazla ne kadar beklenir. */
        private const val MAX_BUSY_WAIT_MS = 30 * 60 * 1000L

        /** Hat bosaldiktan sonra araya girilen nefes payi. */
        private const val FREE_LINE_GRACE_MS = 4000L

        private const val EXTRA_NUMBER = "number"
        private const val EXTRA_EXT = "ext"
        private const val EXTRA_INTERVAL = "interval"
        private const val EXTRA_REPEATS = "repeats"
        private const val EXTRA_RING = "ring"
        private const val EXTRA_STOP_ANSWERED = "stopAnswered"
        private const val EXTRA_HANGUP = "hangup"
        private const val EXTRA_SPEAKER = "speaker"
        private const val EXTRA_LABEL = "label"

        fun start(context: Context, config: RedialConfig, label: String = "") {
            val cfg = config.sanitized()
            val i = Intent(context, RedialService::class.java).apply {
                putExtra(EXTRA_NUMBER, cfg.number)
                putExtra(EXTRA_EXT, cfg.extension)
                putExtra(EXTRA_INTERVAL, cfg.intervalSec)
                putExtra(EXTRA_REPEATS, cfg.repeats)
                putExtra(EXTRA_RING, cfg.ringSec)
                putExtra(EXTRA_STOP_ANSWERED, cfg.stopWhenAnswered)
                putExtra(EXTRA_HANGUP, cfg.hangUpOnTimeout)
                putExtra(EXTRA_SPEAKER, cfg.speaker)
                putExtra(EXTRA_LABEL, label)
            }
            ContextCompat.startForegroundService(context, i)
        }

        fun stop(context: Context) {
            val i = Intent(context, RedialService::class.java).setAction(ACTION_STOP)
            try {
                ContextCompat.startForegroundService(context, i)
            } catch (e: Exception) {
                context.stopService(Intent(context, RedialService::class.java))
                RedialState.update {
                    it.copy(running = false, phase = Phase.FINISHED, finishedReason = "Durduruldu")
                }
            }
        }

        private fun Intent.toConfig(): RedialConfig? {
            val number = getStringExtra(EXTRA_NUMBER) ?: return null
            return RedialConfig(
                number = number,
                extension = getStringExtra(EXTRA_EXT).orEmpty(),
                intervalSec = getIntExtra(EXTRA_INTERVAL, 30),
                repeats = getIntExtra(EXTRA_REPEATS, 10),
                ringSec = getIntExtra(EXTRA_RING, 30),
                stopWhenAnswered = getBooleanExtra(EXTRA_STOP_ANSWERED, true),
                hangUpOnTimeout = getBooleanExtra(EXTRA_HANGUP, true),
                speaker = getBooleanExtra(EXTRA_SPEAKER, false)
            ).sanitized()
        }

        fun ensureChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_RUN, "Tekrar arama sürüyor", NotificationManager.IMPORTANCE_LOW
                ).apply { description = "Otomatik arama döngüsü çalışırken görünen bildirim" }
            )
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_DONE, "Sonuç", NotificationManager.IMPORTANCE_HIGH
                ).apply { description = "Döngü bittiğinde ya da çağrı cevaplandığında uyarır" }
            )
        }
    }
}
