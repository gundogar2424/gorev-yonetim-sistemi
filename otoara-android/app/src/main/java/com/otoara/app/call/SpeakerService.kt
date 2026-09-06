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
 * Arama ekranini okuyup iki is yapar:
 *
 *  1. **Hoparloru acar** — arama ekranindaki hoparlor dugmesine basarak.
 *     Samsung gibi cihazlarda cagrinin ses yolu tamamen varsayilan telefon
 *     uygulamasinin kontrolundedir; disaridan yapilan `setSpeakerphoneOn` /
 *     `setCommunicationDevice` cagrilari yok sayilir. Geriye tek gercekci yol
 *     kullanicinin yapacagi dokunusu onun adina yapmaktir.
 *
 *  2. **"Cevaplandi"yi tespit eder** — ekrandaki gorusme sayaci (00:12 gibi)
 *     ancak karsi taraf actiktan sonra baslar ve ilerler. Sayacin ilerledigini
 *     gorunce cagri cevaplanmis demektir; boylece uygulama suren bir gorusmeyi
 *     kesmez ve tekrar aramayi durdurur.
 *
 * Sinirlar (bilerek dar tutuldu):
 *  - Hicbir sey yapmaz — ta ki uygulamanin **kendi tekrar arama dongusu**
 *    calisip bir cagri surene kadar. Diger tum zamanlarda gelen olaylar ilk
 *    satirda birakilir.
 *  - Ekranda yalnizca hoparlor dugmesi ve gorusme sayaci aranir.
 *  - Hicbir icerik kaydedilmez, saklanmaz, hicbir yere gonderilmez.
 *  - Hoparlor zaten aciksa dokunulmaz; her cagri icin en fazla bir kez basilir.
 */
class SpeakerService : AccessibilityService() {

    private var lastClickAt = 0L
    private var handledTry = -1

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        // Tek ve sert kosul: yalnizca kendi cagrimiz surerken calisir.
        val status = RedialState.status.value
        if (!status.running || status.phase != Phase.IN_CALL) return

        CallScreen.dialerPackage = event.packageName?.toString()

        val root = rootInActiveWindow ?: return

        // 1) Cevaplandi mi? (gorusme sayaci ilerliyor mu)
        findTimer(root, 0)?.let { CallScreen.reportTimer(it) }

        // 2) Hoparlor
        if (!Prefs(this).speaker) return
        if (Speaker.isOn(this)) return
        if (handledTry == status.tryNo) return

        val now = SystemClock.elapsedRealtime()
        if (now - lastClickAt < CLICK_COOLDOWN_MS) return

        val target = findSpeakerNode(root, 0) ?: return
        if (target.isChecked) return

        if (clickSelfOrParent(target)) {
            lastClickAt = now
            handledTry = status.tryNo
            RedialState.update { it.copy(speakerOn = true) }
        }
    }

    override fun onInterrupt() = Unit

    // ------------------------------------------------------------ arama

    /** Ekranda "0:12" / "00:12" / "1:02:03" bicimindeki sayaci arar. */
    private fun findTimer(node: AccessibilityNodeInfo?, depth: Int): String? {
        if (node == null || depth > MAX_DEPTH) return null

        node.text?.toString()?.trim()?.let { text ->
            if (TIMER.matches(text)) return text
        }

        for (i in 0 until node.childCount) {
            findTimer(node.getChild(i), depth + 1)?.let { return it }
        }
        return null
    }

    /** Ekranda hoparlor dugmesini arar. */
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
        return v.contains("speaker") ||
            v.contains("hoparlör") ||
            v.contains("hoparlor") ||
            v.contains("audioroute") ||
            v.contains("audio_route") ||
            v.contains("audiobutton") ||
            v.contains("audio_button")
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
        private val TIMER = Regex("""^\d{1,2}:\d{2}(:\d{2})?$""")

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
