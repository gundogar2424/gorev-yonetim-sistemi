package com.karttakip.app.notif

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.getSystemService
import com.karttakip.app.MainActivity
import com.karttakip.app.R
import com.karttakip.app.data.AppDatabase
import com.karttakip.app.data.Card
import com.karttakip.app.domain.CardCalc
import com.karttakip.app.widget.KartWidgetProvider
import kotlinx.coroutines.runBlocking
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Tam-zamanli alarmlarla (AlarmManager) her kart icin bildirimleri planlar.
 * Alarmlar tek seferliktir; tetiklenince [ReminderReceiver] bir sonraki dongu
 * icin yeniden planlar. Ayrica acilista ve DB degisince de yeniden planlanir.
 */
object NotificationScheduler {

    // Alarm kanali (yeni id — kanal ayarlari ilk olusturuldugunda sabitlenir)
    const val CHANNEL_ID = "karttakip_alarm"
    private val NOTIFY_TIME: LocalTime = LocalTime.of(10, 0) // sabah 10:00
    private val dateFmt = DateTimeFormatter.ofPattern("d MMMM EEEE", Locale("tr", "TR"))

    // Alarm turleri
    private const val TYPE_REMIND = 1  // son odemeden X gun once (tek sefer)
    private const val TYPE_DUE = 2     // son odeme gunu baslangic (tek sefer)
    private const val TYPE_STATEMENT = 3 // ekstre kesim gunu (tek sefer)
    private const val TYPE_NAG = 4     // "ödedim" denene kadar 3-4 saatte bir

    // Nag saatleri: son gun ~3-4 saatte bir, gece 23:00'e kadar. 00:00 sonrasi sessiz.
    private val NAG_SLOTS = listOf(
        LocalTime.of(9, 0), LocalTime.of(12, 30), LocalTime.of(16, 0),
        LocalTime.of(19, 30), LocalTime.of(23, 0)
    )

    // Son 3 gun: gitgide artan hatirlatma (kac gun kala -> o gunku saatler).
    private val RAMP = listOf(
        3 to listOf(LocalTime.of(10, 0)),                                   // 3 gun kala: 1x
        2 to listOf(LocalTime.of(10, 0), LocalTime.of(18, 0)),              // 2 gun kala: 2x
        1 to listOf(LocalTime.of(9, 0), LocalTime.of(14, 0), LocalTime.of(19, 0)) // 1 gun kala: 3x
    )

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService<NotificationManager>() ?: return
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        // Alarm sesi (calar saat gibi), ALARM ses akisindan calsin -> yuksek ve
        // sessiz modda bile duyulur.
        val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val audioAttrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Kart alarmlari",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Hesap kesim ve son odeme tarihi alarmlari (calar tonu)"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 700, 400, 700, 400, 700, 400, 700)
            enableLights(true)
            lightColor = Color.RED
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setSound(alarmUri, audioAttrs)
        }
        nm.createNotificationChannel(channel)
    }

    /** Tum kartlar icin gelecekteki tum alarmlari (yeniden) planlar. */
    fun scheduleAll(context: Context) {
        ensureChannel(context)
        val cards = runBlocking { AppDatabase.get(context).cardDao().getAll() }
        val am = context.getSystemService<AlarmManager>() ?: return
        val today = LocalDate.now()

        for (card in cards) {
            val due = CardCalc.currentDue(card, today)   // "ödedim" denene kadar ilerlemez
            val statement = CardCalc.nextStatement(card, today)
            val borc = if (card.debt > 0) " Borç: ${formatMoney(card.debt)}." else ""

            if (due.isAfter(today)) {
                // Henuz son odeme gunu gelmedi:
                // nag zincirini durdur (odenmis / bir sonraki donguye gecilmis olabilir)
                cancelAlarm(context, am, reqCode(card.id, TYPE_NAG))
                // O an ekranda calan bir nag bildirimi varsa onu da kapat.
                NotificationManagerCompat.from(context).cancel(reqCode(card.id, TYPE_NAG))

                // Son 3 gun: gitgide artan hatirlatma (gecmis olanlar atlanir)
                for ((daysBefore, times) in RAMP) {
                    val date = due.minusDays(daysBefore.toLong())
                    times.forEachIndexed { idx, t ->
                        scheduleAtMillis(
                            context, am, reqCode(card.id, 20 + daysBefore * 5 + idx),
                            date.atTime(t).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(),
                            "${card.name}: son ödemeye $daysBefore gün",
                            "Son ödeme ${dateFmt.format(due)} — $daysBefore gün kaldı.$borc"
                        )
                    }
                }

                // Son odeme gunu — en sik hatirlatma (nag) zincirini baslatir
                scheduleAt(
                    context, am, reqCode(card.id, TYPE_DUE), due,
                    "${card.name}: bugün son ödeme günü!",
                    "Bugün ${card.name} kartının son ödeme günü.$borc Öde ve uygulamada 'Bu ayki ödemeyi yaptım' de."
                )
            } else {
                // Son odeme gunu geldi/gecti ve "ödedim" denmedi:
                // 3-4 saatte bir (gunduz) tekrar hatirlat.
                cancelAlarm(context, am, reqCode(card.id, TYPE_REMIND))
                cancelAlarm(context, am, reqCode(card.id, TYPE_DUE))
                val gecikti = CardCalc.daysUntil(due, today) < 0
                val baslik = if (gecikti) "${card.name}: ödeme GECİKTİ!" else "${card.name}: bugün son ödeme günü!"
                val metin = "Son ödeme ${dateFmt.format(due)}.$borc Öde, sonra 'Bu ayki ödemeyi yaptım' de ki hatırlatma dursun."
                val nagAt = nagNextSlot(LocalDateTime.now())
                scheduleAtMillis(
                    context, am, reqCode(card.id, TYPE_NAG),
                    nagAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(),
                    baslik, metin
                )
            }

            // Ekstre kesim gunu (bilgi)
            scheduleAt(
                context, am, reqCode(card.id, TYPE_STATEMENT), statement,
                "${card.name}: ekstre kesildi",
                "${card.name} ekstresi bugün kesildi. Son ödeme: ${dateFmt.format(CardCalc.nextOccurrenceStrictAfter(CardCalc.dueDayOfMonth(card), statement))}."
            )
        }

        // Widget'i da tazele (kart eklendi/silindi/gun degisti).
        KartWidgetProvider.updateAll(context)
    }

    /** Gunduz saatlerinde, [now]'dan sonraki ilk nag anini dondurur. */
    private fun nagNextSlot(now: LocalDateTime): LocalDateTime {
        val day = now.toLocalDate()
        for (t in NAG_SLOTS) {
            val cand = day.atTime(t)
            if (cand.isAfter(now)) return cand
        }
        return day.plusDays(1).atTime(NAG_SLOTS.first())
    }

    private fun scheduleAtMillis(
        context: Context,
        am: AlarmManager,
        requestCode: Int,
        triggerAt: Long,
        title: String,
        text: String
    ) {
        if (triggerAt <= System.currentTimeMillis()) return
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_TEXT, text)
            putExtra(EXTRA_ID, requestCode)
        }
        val pi = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
        } catch (e: SecurityException) {
            am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    private fun scheduleAt(
        context: Context,
        am: AlarmManager,
        requestCode: Int,
        date: LocalDate,
        title: String,
        text: String
    ) {
        val triggerAt = date.atTime(NOTIFY_TIME)
            .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        if (triggerAt <= System.currentTimeMillis()) return

        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_TEXT, text)
            putExtra(EXTRA_ID, requestCode)
        }
        val pi = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
        } catch (e: SecurityException) {
            am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    /** Daha once kurulmus bir alarmi iptal eder (varsa). */
    private fun cancelAlarm(context: Context, am: AlarmManager, requestCode: Int) {
        val intent = Intent(context, ReminderReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pi != null) {
            am.cancel(pi)
            pi.cancel()
        }
    }

    fun showNotification(context: Context, id: Int, title: String, text: String) {
        ensureChannel(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPi = PendingIntent.getActivity(
            context, id, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notif = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(alarmSound, AudioManager.STREAM_ALARM)
            .setVibrate(longArrayOf(0, 700, 400, 700, 400, 700, 400, 700))
            .setLights(0xFFFF0000.toInt(), 500, 500)
            .setAutoCancel(true)
            .setOngoing(true)
            .setContentIntent(contentPi)
            // Ekrani uyandiran tam-ekran uyari (calar saat gibi)
            .setFullScreenIntent(contentPi, true)
            .build()

        // Sen kapatana kadar calmaya devam etsin (alarm gibi).
        notif.flags = notif.flags or Notification.FLAG_INSISTENT

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return // izin yoksa sessizce cik
        }
        NotificationManagerCompat.from(context).notify(id, notif)
    }

    private fun reqCode(cardId: Long, type: Int): Int = (cardId.toInt() * 100 + type)

    private fun formatMoney(v: Double): String =
        "%,.2f ₺".format(Locale("tr", "TR"), v)

    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    const val EXTRA_ID = "notifId"
}
