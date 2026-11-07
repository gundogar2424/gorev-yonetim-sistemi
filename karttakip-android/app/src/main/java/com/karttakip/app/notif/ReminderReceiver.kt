package com.karttakip.app.notif

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Alarm tetiklendiginde bildirimi gosterir ve sonraki dongu icin yeniden planlar. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(NotificationScheduler.EXTRA_TITLE) ?: "Kart hatırlatma"
        val text = intent.getStringExtra(NotificationScheduler.EXTRA_TEXT) ?: ""
        val id = intent.getIntExtra(NotificationScheduler.EXTRA_ID, 1)
        val soft = intent.getBooleanExtra(NotificationScheduler.EXTRA_SOFT, false)

        if (soft) {
            // Kampanya uyarisi: normal bildirim (calmaz).
            NotificationScheduler.showSoftNotification(context, id, title, text)
        } else {
            NotificationScheduler.showNotification(context, id, title, text)
        }
        // Bu alarm tek seferlikti; sonraki ay/uyari icin yeniden kur.
        NotificationScheduler.scheduleAll(context)
    }
}
