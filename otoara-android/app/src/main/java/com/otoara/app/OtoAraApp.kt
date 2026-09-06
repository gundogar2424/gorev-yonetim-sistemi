package com.otoara.app

import android.app.Application
import com.otoara.app.call.RedialService
import com.otoara.app.plan.PlanScheduler

class OtoAraApp : Application() {
    override fun onCreate() {
        super.onCreate()
        RedialService.ensureChannels(this)
        PlanScheduler.ensureChannel(this)
    }
}
