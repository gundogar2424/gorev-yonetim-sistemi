package com.karttakip.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.karttakip.app.MainActivity
import com.karttakip.app.R
import com.karttakip.app.data.AppDatabase
import com.karttakip.app.domain.CardCalc
import kotlinx.coroutines.runBlocking
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Ana ekran widget'i: uygulamayi acmadan en yakin odeme ve bugun kullanilacak kart. */
class KartWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) render(context, appWidgetManager, id)
    }

    companion object {
        private val dateFmt = DateTimeFormatter.ofPattern("d MMM", Locale("tr", "TR"))

        /** Tum yerlesik widget'lari gunceller (kart eklenince/silinince cagrilir). */
        fun updateAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context) ?: return
            val ids = mgr.getAppWidgetIds(ComponentName(context, KartWidgetProvider::class.java))
            for (id in ids) render(context, mgr, id)
        }

        private fun render(context: Context, mgr: AppWidgetManager, id: Int) {
            val cards = runBlocking { AppDatabase.get(context).cardDao().getAll() }
            val today = LocalDate.now()
            val views = RemoteViews(context.packageName, R.layout.widget_karttakip)

            if (cards.isEmpty()) {
                views.setTextViewText(R.id.tvUrgent, "Henüz kart yok")
                views.setTextViewText(R.id.tvBest, "Eklemek için dokun")
            } else {
                val urgent = CardCalc.mostUrgentPayment(cards, today)
                if (urgent != null) {
                    val due = CardCalc.nextDue(urgent, today)
                    val days = CardCalc.daysUntil(due, today)
                    val borc = if (urgent.debt > 0) " • ${money(urgent.debt)}" else ""
                    views.setTextViewText(
                        R.id.tvUrgent,
                        "${urgent.name}: $days gün (${dateFmt.format(due)})$borc"
                    )
                }
                val best = CardCalc.bestCardToUse(cards, today)
                if (best != null) {
                    views.setTextViewText(
                        R.id.tvBest,
                        "Bugün kullan: ${best.name} (${CardCalc.floatDays(best, today)} gün faizsiz)"
                    )
                }
            }

            val pi = PendingIntent.getActivity(
                context, 0,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetRoot, pi)

            mgr.updateAppWidget(id, views)
        }

        private fun money(v: Double): String = "%,.0f ₺".format(Locale("tr", "TR"), v)
    }
}
