package com.otoara.app.call

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.otoara.app.data.Prefs
import java.util.Locale

/**
 * Hoparloru **arama ekranindaki dugmeye basarak** acar.
 *
 * Neden boyle: Samsung gibi bazi ureticilerde bir telefon cagrisinin ses yolu
 * tamamen varsayilan telefon uygulamasinin kontrolundedir; disaridan yapilan
 * `setCommunicationDevice` / `setSpeakerphoneOn` cagrilari yok sayilir ya da
 * aninda geri alinir. Geriye tek gercekci yol kaliyor: kullanicinin yapacagi
 * dokunusu onun adina yapmak.
 *
 * Sinirlar (bilerek dar tutuldu):
 *  - Hizmet yalnizca telefon/arama uygulamalarindan olay alir
 *    (bkz. res/xml/speaker_service.xml — `packageNames`).
 *  - Yalnizca uygulamanin kendi tekrar arama dongusu calisirken ve kullanici
 *    "Hoparlörü aç" secenegini isaretlemisken is yapar.
 *  - Ekranda sadece "hoparlör / speaker" dugmesi aranir, ona basilir.
 *    Baska hicbir icerik okunmaz, kaydedilmez, hicbir yere gonderilmez.
 *  - Hoparlor zaten aciksa dokunulmaz (kapatmaz).
 */
class SpeakerService : AccessibilityService() {

    private var lastClickAt = 0L

    /** Hangi deneme icin dugmeye basildi — her cagri icin bir kez yeter. */
    private var handledTry = -1

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        // Yalnizca bizim dongumuz calisirken ve hoparlor istenmisken.
        if (!RedialState.status.value.running) return
        if (!Prefs(this).speaker) return
        // Cagri suruyor mu?
        if (RedialState.status.value.phase != Phase.IN_CALL) return
        // Zaten aciksa karisma.
        if (Speaker.isOn(this)) return

        // Ayni cagri icin tekrar basma: aksi halde acip kapatma ihtimali var.
        val tryNo = RedialState.status.value.tryNo
        if (handledTry == tryNo) return

        val now = SystemClock.elapsedRealtime()
        if (now - lastClickAt < CLICK_COOLDOWN_MS) return

        val root = rootInActiveWindow ?: return
        val target = findSpeakerNode(root, 0) ?: return
        if (target.isChecked) return

        if (clickSelfOrParent(target)) {
            lastClickAt = now
            handledTry = tryNo
            RedialState.update { it.copy(speakerOn = true) }
        }
    }

    override fun onInterrupt() = Unit

    /** Ekranda "hoparlör / speaker" dugmesini arar. */
    private fun findSpeakerNode(node: AccessibilityNodeInfo?, depth: Int): AccessibilityNodeInfo? {
        if (node == null || depth > MAX_DEPTH) return null

        if (looksLikeSpeaker(node.viewIdResourceName) ||
            looksLikeSpeaker(node.contentDescription?.toString()) ||
            looksLikeSpeaker(node.text?.toString())
        ) {
            return node
        }

        for (i in 0 until node.childCount) {
            findSpeakerNode(node.getChild(i), depth + 1)?.let { return it }
        }
        return null
    }

    private fun looksLikeSpeaker(value: String?): Boolean {
        val v = value?.lowercase(TR) ?: return false
        return v.contains("speaker") || v.contains("hoparlör") || v.contains("hoparlor")
    }

    /** Dugmenin kendisi tiklanabilir degilse en yakin tiklanabilir ustune basar. */
    private fun clickSelfOrParent(node: AccessibilityNodeInfo): Boolean {
        var current: AccessibilityNodeInfo? = node
        var hops = 0
        while (current != null && hops < 5) {
            if (current.isClickable && current.isEnabled) {
                return current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            current = current.parent
            hops++
        }
        return false
    }

    companion object {
        private const val CLICK_COOLDOWN_MS = 2000L
        private const val MAX_DEPTH = 30
        private val TR = Locale("tr")

        /** Kullanici bu hizmeti Ayarlar'dan acmis mi. */
        fun isEnabled(context: Context): Boolean {
            val expected = "${context.packageName}/${SpeakerService::class.java.name}"
            val enabled = try {
                Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                )
            } catch (e: Exception) {
                null
            } ?: return false
            return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
        }
    }
}
