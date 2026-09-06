package com.otoara.app.call

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.CallLog
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

/**
 * Telefon (cagri) islerinin tamami burada. Uygulamanin geri kalani Android'in
 * telefon API'lerini dogrudan kullanmaz.
 */
object Phone {

    fun has(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun canCall(context: Context) = has(context, Manifest.permission.CALL_PHONE)

    fun canReadState(context: Context) = has(context, Manifest.permission.READ_PHONE_STATE)

    fun canReadCallLog(context: Context) = has(context, Manifest.permission.READ_CALL_LOG)

    /** Cagriyi kapatabilmek icin gereken izin (Android 9+). */
    fun canHangUp(context: Context) =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            has(context, Manifest.permission.ANSWER_PHONE_CALLS)

    /**
     * Numarayi arar. Once TelecomManager kullanilir (arka planda, ekran
     * kapaliyken de calisir); olmazsa klasik ACTION_CALL'a duser.
     */
    @SuppressLint("MissingPermission")
    fun place(context: Context, dialString: String): Boolean {
        if (!canCall(context)) return false
        val uri = Uri.fromParts("tel", dialString, null)

        try {
            val tm = context.getSystemService(TelecomManager::class.java)
            if (tm != null) {
                tm.placeCall(uri, null)
                return true
            }
        } catch (e: Exception) {
            // Bazi cihazlarda placeCall engellenebiliyor; asagidaki yola dusulur.
        }

        return try {
            context.startActivity(
                Intent(Intent.ACTION_CALL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Suren cagriyi kapatir. Android 9 oncesinde mumkun degildir. */
    @SuppressLint("MissingPermission")
    fun hangUp(context: Context): Boolean {
        if (!canHangUp(context)) return false
        return try {
            context.getSystemService(TelecomManager::class.java)?.endCall() ?: false
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Su anki cagri durumu: [TelephonyManager.CALL_STATE_IDLE],
     * [TelephonyManager.CALL_STATE_OFFHOOK] veya
     * [TelephonyManager.CALL_STATE_RINGING].
     */
    @SuppressLint("MissingPermission")
    fun callState(context: Context): Int {
        val tm = context.getSystemService(TelephonyManager::class.java)
            ?: return TelephonyManager.CALL_STATE_IDLE
        return try {
            @Suppress("DEPRECATION")
            tm.callState
        } catch (e: SecurityException) {
            TelephonyManager.CALL_STATE_IDLE
        }
    }

    /**
     * Arama kaydindaki **son giden cagrinin** konusma suresi (saniye).
     * Android'de bu sure yalnizca karsi taraf **actiysa** 0'dan buyuktur; yani
     * "cevaplandi mi?" sorusunun tek guvenilir cevabi budur.
     *
     * Izin yoksa ya da kayit bulunamazsa `null` doner.
     */
    fun lastOutgoingDuration(context: Context, number: String): Int? {
        if (!canReadCallLog(context)) return null
        val wanted = normalize(number)
        if (wanted.isEmpty()) return null
        return try {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DURATION, CallLog.Calls.TYPE),
                "${CallLog.Calls.TYPE} = ?",
                arrayOf(CallLog.Calls.OUTGOING_TYPE.toString()),
                "${CallLog.Calls.DATE} DESC LIMIT 1"
            )?.use { c ->
                if (!c.moveToFirst()) return null
                val logged = normalize(c.getString(0) ?: "")
                if (!matches(logged, wanted)) return null
                c.getInt(1)
            }
        } catch (e: Exception) {
            null
        }
    }

    /** Numaralari karsilastirmak icin sadece rakamlari birakir. */
    private fun normalize(raw: String) = raw.filter { it.isDigit() }

    /** Ulke kodu/basindaki 0 farkliliklarini tolere ederek karsilastirir. */
    private fun matches(a: String, b: String): Boolean {
        if (a.isEmpty() || b.isEmpty()) return false
        val n = minOf(a.length, b.length, 9)
        return a.takeLast(n) == b.takeLast(n)
    }
}
