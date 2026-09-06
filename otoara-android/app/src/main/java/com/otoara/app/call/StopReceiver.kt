package com.otoara.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Bildirimdeki "Durdur" ve "Görüşmedeyim" dugmeleri buraya duser. */
class StopReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_KEEP -> RedialService.keepCall(context)
            else -> RedialService.stop(context)
        }
    }

    companion object {
        /** "Görüşmedeyim, kesme" — suren cagri korunur, dongu biter. */
        const val ACTION_KEEP = "com.otoara.app.action.KEEP_CALL"
    }
}
