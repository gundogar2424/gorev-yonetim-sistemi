package com.otoara.app.plan

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.otoara.app.MainActivity
import com.otoara.app.R
import com.otoara.app.call.RedialService
import com.otoara.app.data.AppDatabase
import com.otoara.app.data.Plan
import com.otoara.app.data.PlanRepeat
import com.otoara.app.data.Prefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Planlanan zaman gelince kullaniciya **sorar**. Hicbir kosulda kendiliginden
 * arama baslatmaz; arama ancak bildirimdeki "Ara" dugmesine basilirsa baslar.
 */
class PlanReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getLongExtra(EXTRA_ID, 0L)
        if (id == 0L) return
        val action = intent.action ?: return
        val app = context.applicationContext

        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val dao = AppDatabase.get(app).planDao()
                val plan = dao.byId(id) ?: return@launch

                when (action) {
                    ACTION_FIRE -> {
                        notifyAsk(app, plan)
                        advance(app, plan)
                    }

                    ACTION_CALL -> {
                        NotificationManagerCompat.from(app).cancel(notifId(id))
                        startCall(app, plan)
                    }

                    ACTION_SNOOZE -> {
                        NotificationManagerCompat.from(app).cancel(notifId(id))
                        PlanScheduler.snooze(app, id, SNOOZE_MINUTES)
                    }

                    ACTION_DISMISS -> {
                        NotificationManagerCompat.from(app).cancel(notifId(id))
                    }
                }
            } finally {
                pending.finish()
            }
        }
    }

    /** Tekrarli plani bir sonraki zamana tasir; tek seferlik plani kapatir. */
    private suspend fun advance(context: Context, plan: Plan) {
        val dao = AppDatabase.get(context).planDao()
        if (plan.repeat == PlanRepeat.ONCE) {
            val done = plan.copy(enabled = false)
            dao.update(done)
            PlanScheduler.cancel(context, plan.id)
        } else {
            val next = plan.nextTime() ?: return
            val moved = plan.copy(timeAt = next)
            dao.update(moved)
            PlanScheduler.schedule(context, moved)
        }
    }

    /** Kullanici "Ara" dedi: kayitli zamanlama ayarlariyla donguyu baslatir. */
    private fun startCall(context: Context, plan: Plan) {
        val cfg = Prefs(context).toConfig().copy(number = plan.number)
        RedialService.start(context, cfg, plan.label)
        try {
            context.startActivity(
                Intent(context, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            )
        } catch (e: Exception) {
            // Ekran acilamadiysa dongu yine de bildirimden takip edilebilir.
        }
    }

    private fun notifyAsk(context: Context, plan: Plan) {
        PlanScheduler.ensureChannel(context)

        val open = PendingIntent.getActivity(
            context, notifId(plan.id),
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(MainActivity.EXTRA_PLAN_NUMBER, plan.number)
                .putExtra(MainActivity.EXTRA_PLAN_LABEL, plan.label),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val text = buildString {
            append(plan.number)
            if (plan.note.isNotBlank()) append("  •  ").append(plan.note)
        }

        val n = NotificationCompat.Builder(context, PlanScheduler.CHANNEL_PLAN)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("${plan.title} aranacaktı")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(open)
            .addAction(0, "Ara", action(context, plan.id, ACTION_CALL))
            .addAction(0, "$SNOOZE_MINUTES dk ertele", action(context, plan.id, ACTION_SNOOZE))
            .addAction(0, "Vazgeç", action(context, plan.id, ACTION_DISMISS))
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notifId(plan.id), n)
        } catch (e: SecurityException) {
            // Bildirim izni yok.
        }
    }

    /**
     * Her dugme icin benzersiz istek kodu. Alarm (planId) ve erteleme
     * (1.000.000 + planId) araliklariyla cakismamasi icin 10.000.000'dan
     * baslar.
     */
    private fun action(context: Context, planId: Long, act: String): PendingIntent {
        val slot = when (act) {
            ACTION_CALL -> 0
            ACTION_SNOOZE -> 1
            else -> 2
        }
        return PendingIntent.getBroadcast(
            context,
            10_000_000 + planId.toInt() * 4 + slot,
            Intent(context, PlanReceiver::class.java)
                .setAction(act)
                .putExtra(EXTRA_ID, planId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    companion object {
        const val EXTRA_ID = "planId"
        const val ACTION_FIRE = "com.otoara.app.plan.FIRE"
        const val ACTION_CALL = "com.otoara.app.plan.CALL"
        const val ACTION_SNOOZE = "com.otoara.app.plan.SNOOZE"
        const val ACTION_DISMISS = "com.otoara.app.plan.DISMISS"

        private const val SNOOZE_MINUTES = 15

        private fun notifId(planId: Long) = 2000 + planId.toInt()
    }
}
