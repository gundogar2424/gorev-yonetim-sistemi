package com.seslipdf.app.tts

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Bildirimdeki oynat/duraklat, ileri/geri ve kapat dugmeleri buraya duser. */
class ReaderActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ReaderService.ACTION_TOGGLE -> ReaderService.toggle(context)
            ReaderService.ACTION_NEXT -> ReaderService.next(context)
            ReaderService.ACTION_PREV -> ReaderService.previous(context)
            ReaderService.ACTION_STOP -> ReaderService.close(context)
        }
    }
}
