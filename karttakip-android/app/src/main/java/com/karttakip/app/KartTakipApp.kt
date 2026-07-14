package com.karttakip.app

import android.app.Application
import com.karttakip.app.notif.NotificationScheduler

class KartTakipApp : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationScheduler.ensureChannel(this)
    }
}
