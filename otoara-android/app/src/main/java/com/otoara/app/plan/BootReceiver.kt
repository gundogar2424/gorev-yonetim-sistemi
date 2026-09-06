package com.otoara.app.plan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Telefon yeniden baslayinca planli aramalarin alarmlari yeniden kurulur. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                PlanScheduler.scheduleAll(app)
            } finally {
                pending.finish()
            }
        }
    }
}
