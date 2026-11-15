package com.karttakip.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.util.Locale

/**
 * Bir kredi karti kampanyasi. Veri, GitHub'da tutulan campaigns.json'dan gelir;
 * liste Claude tarafindan duzenli guncellenir (uygulamada yapay zeka calismaz,
 * token gerekmez — sadece bir metin dosyasi indirilir).
 */
data class Campaign(
    val program: String,
    val match: List<String>,
    val title: String,
    val detail: String,
    val category: String,
    val reward: String,
    val minSpend: String,
    val validUntil: String,
    val url: String
)

/**
 * Kullanicinin Claude'a "su kampanyaya katildim" dedigi, uzaktan gelen takip
 * kaydi. Uygulama bunu bir kez (id'ye gore) yerel TrackedCampaign'e cevirir,
 * uygun karta baglar ve hatirlatmalarini kurar.
 */
data class RemoteTracked(
    val id: String,
    val match: List<String>,
    val title: String,
    val reward: String,
    val targetSpend: Double,
    val deadlineEpochDay: Long,
    val url: String,
    val joined: Boolean
)

data class CampaignData(
    val updated: String,
    val note: String,
    val campaigns: List<Campaign>,
    val tracked: List<RemoteTracked> = emptyList()
)

object CampaignRepository {
    // Depodaki campaigns.json'un ham (raw) adresi. Depo herkese aciktir.
    private const val URL_STR =
        "https://raw.githubusercontent.com/gundogar2424/gorev-yonetim-sistemi/main/karttakip-android/campaigns.json"
    private const val PREFS = "campaigns"
    private const val KEY_JSON = "json"
    private const val KEY_DISMISSED = "dismissed"

    private val tr = Locale("tr", "TR")

    /** Kullanicinin "Yok say" dedigi kampanyalarin anahtarlari (baslik). */
    fun dismissed(context: Context): Set<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_DISMISSED, emptySet()) ?: emptySet()

    fun setDismissed(context: Context, keys: Set<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putStringSet(KEY_DISMISSED, keys).apply()
    }

    /** Daha once indirilmis liste (internet yoksa gosterilir). */
    fun cached(context: Context): CampaignData? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_JSON, null) ?: return null
        return runCatching { parse(raw) }.getOrNull()
    }

    /** Internetten gunceli ceker; basarisizsa en son indirileni dondurur. */
    fun fetch(context: Context): CampaignData? {
        return try {
            val conn = (URL(URL_STR).openConnection() as HttpURLConnection).apply {
                connectTimeout = 10000
                readTimeout = 10000
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
            }
            try {
                if (conn.responseCode != 200) return cached(context)
                val raw = conn.inputStream.bufferedReader().use { it.readText() }
                val data = parse(raw)
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString(KEY_JSON, raw).apply()
                data
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            cached(context)
        }
    }

    private fun parse(raw: String): CampaignData {
        val o = JSONObject(raw)
        val arr = o.optJSONArray("campaigns") ?: JSONArray()
        val list = ArrayList<Campaign>(arr.length())
        for (i in 0 until arr.length()) {
            val c = arr.optJSONObject(i) ?: continue
            val m = c.optJSONArray("match")
            val matches = ArrayList<String>()
            if (m != null) for (j in 0 until m.length()) matches.add(m.optString(j).lowercase(tr))
            list.add(
                Campaign(
                    program = c.optString("program"),
                    match = matches,
                    title = c.optString("title"),
                    detail = c.optString("detail"),
                    category = c.optString("category"),
                    reward = c.optString("reward"),
                    minSpend = c.optString("minSpend"),
                    validUntil = c.optString("validUntil"),
                    url = c.optString("url")
                )
            )
        }
        // Uzaktan gelen takip kayitlari ("tracked"): kullanicinin katildigini soyledigi kampanyalar.
        val tArr = o.optJSONArray("tracked") ?: JSONArray()
        val trackedList = ArrayList<RemoteTracked>(tArr.length())
        for (i in 0 until tArr.length()) {
            val t = tArr.optJSONObject(i) ?: continue
            val id = t.optString("id")
            if (id.isBlank()) continue
            val m = t.optJSONArray("match")
            val matches = ArrayList<String>()
            if (m != null) for (j in 0 until m.length()) matches.add(m.optString(j).lowercase(tr))
            val deadline = t.optString("deadline") // "YYYY-MM-DD"
            val deadlineEpoch = runCatching { LocalDate.parse(deadline).toEpochDay() }.getOrDefault(0L)
            trackedList.add(
                RemoteTracked(
                    id = id,
                    match = matches,
                    title = t.optString("title"),
                    reward = t.optString("reward"),
                    targetSpend = t.optDouble("targetSpend", 0.0).coerceAtLeast(0.0),
                    deadlineEpochDay = deadlineEpoch,
                    url = t.optString("url"),
                    joined = t.optBoolean("joined", true)
                )
            )
        }
        return CampaignData(o.optString("updated"), o.optString("note"), list, trackedList)
    }

    private const val KEY_IMPORTED = "imported_tracked"

    /** Daha once yerel takibe cevrilmis uzak kayit id'leri (tekrar eklenmesin, silinen geri gelmesin). */
    fun importedIds(context: Context): Set<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_IMPORTED, emptySet()) ?: emptySet()

    fun setImportedIds(context: Context, ids: Set<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putStringSet(KEY_IMPORTED, ids).apply()
    }

    /** Kart adi/bankasi verilen anahtarlardan birini iceriyor mu? */
    fun matches(card: Card, keywords: List<String>): Boolean {
        val hay = (card.name + " " + card.bank).lowercase(tr)
        return keywords.any { it.isNotBlank() && hay.contains(it) }
    }

    /** Bu kampanya bu karta uygun mu? (kart adi/bankasi, match anahtarlarini iceriyorsa) */
    fun matches(card: Card, c: Campaign): Boolean = matches(card, c.match)
}
