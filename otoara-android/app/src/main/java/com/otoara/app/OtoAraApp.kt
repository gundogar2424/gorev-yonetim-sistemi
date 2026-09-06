package com.otoara.app

import android.app.Application
import com.otoara.app.call.RedialService

class OtoAraApp : Application() {
    override fun onCreate() {
        super.onCreate()
        RedialService.ensureChannels(this)
    }
}
