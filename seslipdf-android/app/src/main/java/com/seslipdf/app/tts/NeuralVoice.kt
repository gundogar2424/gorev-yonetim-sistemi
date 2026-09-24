package com.seslipdf.app.tts

import android.content.Context
import android.util.Log
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsSupertonicModelConfig

/**
 * Cihaz ici dogal Türkçe ses: Supertonic 3 (sherpa-onnx ile calisir).
 *
 * 31 dilli, 10 sesli yeni nesil bir model; telefonda calismak icin
 * tasarlanmis. Tamamen cihaz icinde calisir, internet istemez. Sistemin
 * seslendirme motorundan belirgin sekilde daha dogal okur ama daha agirdir:
 * model ~140 MB, her cumle icin kisa bir hesaplama gerekir.
 *
 * Model APK'nin icinde (assets/supertonic) gelir ve oradan dogrudan okunur.
 */
object NeuralVoice {

    private const val TAG = "NeuralVoice"
    private const val DIR = "supertonic"

    /** Modeldeki ses sayisi. Kullaniciya 1..10 olarak gosterilir. */
    const val VOICE_COUNT = 10

    /** Varsayilan ses: kullanicinin denemelerde sectigi "3 numarali ses". */
    const val DEFAULT_VOICE = 2

    /**
     * Akis adimi: fazlasi daha temiz ses, daha cok hesap. 8, orneklerde
     * dinlenip begenilen kalite.
     */
    private const val NUM_STEPS = 8

    @Volatile private var engine: OfflineTts? = null

    /** Motor acilamadiysa kullaniciya gosterilecek sebep. */
    @Volatile var failure: String? = null
        private set

    /** Ses paketi bu yapiya konmus mu (APK'da assets var mi). */
    fun isBundled(context: Context): Boolean = try {
        context.assets.open("$DIR/vector_estimator.int8.onnx").close()
        true
    } catch (e: Exception) {
        false
    }

    /** Motor hazir mi (henuz acilmadiysa acilabilir mi). */
    fun isAvailable(context: Context): Boolean = engine != null || isBundled(context)

    /**
     * Motoru (gerekiyorsa) acar. Ilk cagri birkac saniye surebilir: model
     * belleğe yuklenir. Acilamazsa null doner ve [failure] doldurulur;
     * cagiran sistem sesine duser.
     */
    @Synchronized
    fun engine(context: Context): OfflineTts? {
        engine?.let { return it }
        if (!isBundled(context)) {
            failure = "Bu yapıda doğal ses paketi yok."
            return null
        }
        return try {
            val config = OfflineTtsConfig(
                model = OfflineTtsModelConfig(
                    supertonic = OfflineTtsSupertonicModelConfig(
                        durationPredictor = "$DIR/duration_predictor.int8.onnx",
                        textEncoder = "$DIR/text_encoder.int8.onnx",
                        vectorEstimator = "$DIR/vector_estimator.int8.onnx",
                        vocoder = "$DIR/vocoder.int8.onnx",
                        ttsJson = "$DIR/tts.json",
                        unicodeIndexer = "$DIR/unicode_indexer.bin",
                        voiceStyle = "$DIR/voice.bin"
                    ),
                    // Telefonun buyuk cekirdekleri: cumle okunurken bir sonrakinin
                    // zamaninda hazir olmasi icin.
                    numThreads = 4,
                    debug = false,
                    provider = "cpu"
                ),
                // Her cumleyi kendimiz veriyoruz; motor ayrica bolmesin.
                maxNumSentences = 1
            )
            OfflineTts(assetManager = context.assets, config = config).also {
                engine = it
                failure = null
                Log.i(TAG, "doğal ses hazir: ${it.sampleRate()} Hz, ${it.numSpeakers()} ses")
            }
        } catch (e: Throwable) {
            // Bellek yetmemesi, mimari uyumsuzlugu, bozuk dosya...
            Log.e(TAG, "doğal ses acilamadi", e)
            failure = "Doğal ses bu cihazda açılamadı, telefonun sesine dönüldü."
            engine = null
            null
        }
    }

    /** Modelin ornekleme hizi (Hz). */
    fun sampleRate(context: Context): Int = engine(context)?.sampleRate() ?: 44100

    /**
     * Bir cumleyi seslendirir ve ham ses ornegini dondurur.
     * [speed] 1.0 = normal, [voice] 0..9. Hata olursa null doner.
     */
    fun generate(context: Context, text: String, speed: Float, voice: Int): FloatArray? {
        val tts = engine(context) ?: return null
        return try {
            val config = GenerationConfig(
                sid = voice.coerceIn(0, VOICE_COUNT - 1),
                speed = speed.coerceIn(0.5f, 2.5f),
                numSteps = NUM_STEPS,
                extra = mapOf("lang" to "tr")
            )
            tts.generateWithConfig(text, config).samples
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
}
