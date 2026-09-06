package com.otoara.app.plan

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.otoara.app.data.AppDatabase
import com.otoara.app.data.Plan

/**
 * Planli aramalarin alarmlarini kurar. Zamani gelince [PlanReceiver] devreye
 * girer ve kullaniciya "aransin mi?" diye sorar — kendiliginden aramaz.
 */
object PlanScheduler {

    const val CHANNEL_PLAN = "plan_ask"

    /** Snooze alarmlari asil alarmla cakismasin diye ayri istek kodu araligi. */
    private const val SNOOZE_OFFSET = 1_000_000

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_PLAN, "Planlı arama hatırlatması", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Planladığınız aramanın zamanı geldiğinde sorar"
                enableVibration(true)
            }
        )
    }

    /** Plani (ya da tekrarliysa bir sonraki zamanini) alarma baglar. */
    fun schedule(context: Context, plan: Plan) {
        cancel(context, plan.id)
        if (!plan.enabled) return

        val now = System.currentTimeMillis()
        val at = if (plan.timeAt > now) plan.timeAt else plan.nextTime(now) ?: return

        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val pi = firePendingIntent(context, plan.id)
        try {
            if (canExact(am)) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            } else {
                // Tam-zamanli alarm izni yoksa yaklasik zamanla kurulur.
                am.setWindow(AlarmManager.RTC_WAKEUP, at, 5 * 60_000L, pi)
            }
        } catch (e: SecurityException) {
            am.setWindow(AlarmManager.RTC_WAKEUP, at, 5 * 60_000L, pi)
        }
    }

    /** Hatirlatmayi belirtilen dakika kadar erteler. */
    fun snooze(context: Context, planId: Long, minutes: Int) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val at = System.currentTimeMillis() + minutes * 60_000L
        val pi = PendingIntent.getBroadcast(
            context,
            (planId + SNOOZE_OFFSET).toInt(),
            Intent(context, PlanReceiver::class.java)
                .setAction(PlanReceiver.ACTION_FIRE)
                .putExtra(PlanReceiver.EXTRA_ID, planId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        try {
            if (canExact(am)) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            } else {
                am.setWindow(AlarmManager.RTC_WAKEUP, at, 60_000L, pi)
            }
        } catch (e: SecurityException) {
            am.setWindow(AlarmManager.RTC_WAKEUP, at, 60_000L, pi)
        }
    }

    fun cancel(context: Context, planId: Long) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        am.cancel(firePendingIntent(context, planId))
    }

    /** Tum planlarin alarmlarini yeniden kurar (acilista, yeniden baslatmada). */
    suspend fun scheduleAll(context: Context) {
        val plans = AppDatabase.get(context).planDao().allOnce()
        plans.forEach { schedule(context, it) }
    }

    private fun canExact(am: AlarmManager): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()

    private fun firePendingIntent(context: Context, planId: Long) =
        PendingIntent.getBroadcast(
            context,
            planId.toInt(),
            Intent(context, PlanReceiver::class.java)
                .setAction(PlanReceiver.ACTION_FIRE)
                .putExtra(PlanReceiver.EXTRA_ID, planId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
}
