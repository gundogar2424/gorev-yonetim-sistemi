package com.seslipdf.app.tts

import android.content.Context
import android.util.Log
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import java.io.File

/**
 * Cihaz ici nöral Türkçe ses (Piper/VITS modeli, sherpa-onnx ile calisir).
 *
 * Sistemin kendi seslendirme motorundan belirgin sekilde daha dogal okur ama
 * daha agirdir: model ~60 MB, her cumle icin kisa bir hesaplama gerekir.
 * Tamamen cihaz icinde calisir, internet istemez.
 *
 * Model APK'nin icinde (assets) gelir. espeak-ng verisi ise dosya sisteminden
 * okunmak zorunda oldugu icin ilk kullanimda uygulamanin klasorune kopyalanir.
 */
object NeuralVoice {

    private const val TAG = "NeuralVoice"

    private const val ASSET_MODEL = "tts/model.onnx"
    private const val ASSET_TOKENS = "tts/tokens.txt"
    private const val ASSET_ESPEAK = "espeak-ng-data"

    /** Kopyalanan espeak verisi bu surumle isaretlenir; degisince yenilenir. */
    private const val DATA_VERSION = "1"

    @Volatile private var engine: OfflineTts? = null

    /** Motor acilamadiysa kullaniciya gosterilecek sebep. */
    @Volatile var failure: String? = null
        private set

    /** Ses paketi bu yapiya konmus mu (APK'da assets var mi). */
    fun isBundled(context: Context): Boolean = try {
        context.assets.open(ASSET_MODEL).close()
        true
    } catch (e: Exception) {
        false
    }

    /** Motor hazir mi (henuz acilmadiysa acilabilir mi). */
    fun isAvailable(context: Context): Boolean = engine != null || isBundled(context)

    /**
     * Motoru (gerekiyorsa) acar. Ilk cagri birkac saniye surebilir: model
     * yuklenir ve espeak verisi kopyalanir. Acilamazsa null doner ve [failure]
     * doldurulur; cagiran sistem sesine duser.
     */
    @Synchronized
    fun engine(context: Context): OfflineTts? {
        engine?.let { return it }
        if (!isBundled(context)) {
            failure = "Bu yapıda doğal ses paketi yok."
            return null
        }
        return try {
            val dataDir = ensureEspeakData(context)
            val config = OfflineTtsConfig(
                model = OfflineTtsModelConfig(
                    vits = OfflineTtsVitsModelConfig(
                        model = ASSET_MODEL,
                        tokens = ASSET_TOKENS,
                        dataDir = dataDir
                    ),
                    numThreads = 2,
                    debug = false,
                    provider = "cpu"
                ),
                // Her cumleyi kendimiz veriyoruz; motor ayrica bolmesin.
                maxNumSentences = 1
            )
            OfflineTts(assetManager = context.assets, config = config).also {
                engine = it
                failure = null
                Log.i(TAG, "nöral ses hazir, ornekleme ${it.sampleRate()} Hz")
            }
        } catch (e: Throwable) {
            // Bellek yetmemesi, mimari uyumsuzlugu, bozuk dosya...
            Log.e(TAG, "nöral ses acilamadi", e)
            failure = "Doğal ses bu cihazda açılamadı, sistem sesine dönüldü."
            engine = null
            null
        }
    }

    /** Modelin ornekleme hizi (Hz); motor acik degilse Piper varsayilani. */
    fun sampleRate(context: Context): Int = engine(context)?.sampleRate() ?: 22050

    /**
     * Bir cumleyi seslendirir ve ham ses ornegini dondurur.
     * [speed] 1.0 = normal. Hata olursa null doner.
     */
    fun generate(context: Context, text: String, speed: Float): FloatArray? {
        val tts = engine(context) ?: return null
        return try {
            tts.generate(text = text, sid = 0, speed = speed.coerceIn(0.3f, 3f)).samples
        } catch (e: Throwable) {
            Log.e(TAG, "cumle seslendirilemedi", e)
            null
        }
    }

    @Synchronized
    fun release() {
        try {
            engine?.release()
        } catch (e: Throwable) {
            // Zaten kapanmis olabilir.
        }
        engine = null
    }

    /**
     * espeak-ng verisini assets'ten uygulama klasorune kopyalar (bir kez).
     * espeak dosyalari dogrudan dosya sisteminden acmak zorunda; APK icinden
     * okuyamiyor.
     */
    private fun ensureEspeakData(context: Context): String {
        val target = File(context.filesDir, ASSET_ESPEAK)
        val stamp = File(context.filesDir, "espeak-ng-data.version")
        val ready = target.isDirectory &&
            stamp.exists() && stamp.readText().trim() == DATA_VERSION
        if (!ready) {
            target.deleteRecursively()
            copyAsset(context, ASSET_ESPEAK, target)
            stamp.writeText(DATA_VERSION)
        }
        return target.absolutePath
    }

    /** assets altindaki bir dosyayi/klasoru hedefe kopyalar. */
    private fun copyAsset(context: Context, path: String, target: File) {
        val children = context.assets.list(path).orEmpty()
        if (children.isEmpty()) {
            target.parentFile?.mkdirs()
            context.assets.open(path).use { input ->
                target.outputStream().use { output -> input.copyTo(output, 64 * 1024) }
            }
            return
        }
        target.mkdirs()
        children.forEach { child ->
            copyAsset(context, "$path/$child", File(target, child))
        }
    }
}
