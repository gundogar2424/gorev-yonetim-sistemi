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

        NotificationScheduler.showNotification(context, id, title, text)
        // Bu alarm tek seferlikti; sonraki ay icin yeniden kur.
        NotificationScheduler.scheduleAll(context)
    }
}
