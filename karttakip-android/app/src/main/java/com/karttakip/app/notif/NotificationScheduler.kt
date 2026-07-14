package com.karttakip.app.notif

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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

    const val CHANNEL_ID = "karttakip_reminders"
    private val NOTIFY_TIME: LocalTime = LocalTime.of(10, 0) // sabah 10:00
    private val dateFmt = DateTimeFormatter.ofPattern("d MMMM EEEE", Locale("tr", "TR"))

    // Alarm turleri (istek kodu = kartId * 10 + tur)
    private const val TYPE_REMIND = 1  // son odemeden X gun once
    private const val TYPE_DUE = 2     // son odeme gunu
    private const val TYPE_STATEMENT = 3 // ekstre kesim gunu

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService<NotificationManager>() ?: return
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Kart hatirlatmalari",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Hesap kesim ve son odeme tarihi hatirlatmalari"
            enableVibration(true)
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
            val due = CardCalc.nextDue(card, today)
            val statement = CardCalc.nextStatement(card, today)
            val borc = if (card.debt > 0) " Borç: ${formatMoney(card.debt)}." else ""

            // 1) Son odemeden X gun once
            val remindDate = due.minusDays(card.remindDaysBefore.toLong())
            scheduleAt(
                context, am, reqCode(card.id, TYPE_REMIND), remindDate,
                "${card.name}: son ödeme yaklaşıyor",
                "Son ödeme ${dateFmt.format(due)} (${CardCalc.daysUntil(due, today)} gün kaldı).$borc"
            )

            // 2) Son odeme gunu
            scheduleAt(
                context, am, reqCode(card.id, TYPE_DUE), due,
                "${card.name}: bugün son ödeme günü!",
                "Bugün ${card.name} kartının son ödeme günü.$borc Gecikme faizi yememek için bugün öde."
            )

            // 3) Ekstre kesim gunu
            scheduleAt(
                context, am, reqCode(card.id, TYPE_STATEMENT), statement,
                "${card.name}: ekstre kesildi",
                "${card.name} ekstresi bugün kesildi. Son ödeme: ${dateFmt.format(CardCalc.nextOccurrenceStrictAfter(card.dueDay, statement))}."
            )
        }

        // Widget'i da tazele (kart eklendi/silindi/gun degisti).
        KartWidgetProvider.updateAll(context)
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

    fun showNotification(context: Context, id: Int, title: String, text: String) {
        ensureChannel(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPi = PendingIntent.getActivity(
            context, id, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notif = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(contentPi)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return // izin yoksa sessizce cik
        }
        NotificationManagerCompat.from(context).notify(id, notif)
    }

    private fun reqCode(cardId: Long, type: Int): Int = (cardId.toInt() * 10 + type)

    private fun formatMoney(v: Double): String =
        "%,.2f ₺".format(Locale("tr", "TR"), v)

    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    const val EXTRA_ID = "notifId"
}
