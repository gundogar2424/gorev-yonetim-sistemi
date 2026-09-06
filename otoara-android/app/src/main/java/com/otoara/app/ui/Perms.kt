package com.otoara.app.ui

import android.Manifest
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.otoara.app.call.Phone
import com.otoara.app.call.SpeakerService

/** Uygulamanin ihtiyac duydugu izinlerin o anki durumu. */
data class PermState(
    val call: Boolean = false,
    val phoneState: Boolean = false,
    val hangUp: Boolean = false,
    val callLog: Boolean = false,
    val notifications: Boolean = false,
    val batteryFree: Boolean = false,
    val overlay: Boolean = false,
    /** Hoparloru arama ekranindan acan erisilebilirlik hizmeti acik mi. */
    val speakerService: Boolean = false
) {
    /** Bunlar olmadan uygulama hic calismaz. */
    val ready: Boolean get() = call && phoneState

    companion object {
        fun read(context: Context) = PermState(
            call = Phone.canCall(context),
            phoneState = Phone.canReadState(context),
            hangUp = Phone.canHangUp(context),
            callLog = Phone.canReadCallLog(context),
            notifications = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                Phone.has(context, Manifest.permission.POST_NOTIFICATIONS),
            batteryFree = context.getSystemService(PowerManager::class.java)
                ?.isIgnoringBatteryOptimizations(context.packageName) ?: false,
            overlay = Settings.canDrawOverlays(context),
            speakerService = SpeakerService.isEnabled(context)
        )

        /** Tek seferde istenecek izinler. */
        fun requestList(): Array<String> {
            val list = mutableListOf(
                Manifest.permission.CALL_PHONE,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.READ_CALL_LOG
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                list += Manifest.permission.ANSWER_PHONE_CALLS
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                list += Manifest.permission.POST_NOTIFICATIONS
            }
            return list.toTypedArray()
        }
    }
}
