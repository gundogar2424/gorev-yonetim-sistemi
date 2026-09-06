package com.otoara.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Bildirimdeki "Durdur" dugmesi buraya duser. */
class StopReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        RedialService.stop(context)
    }
}
