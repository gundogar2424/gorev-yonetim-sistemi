package com.karttakip.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
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

data class CampaignData(
    val updated: String,
    val note: String,
    val campaigns: List<Campaign>
)

object CampaignRepository {
    // Depodaki campaigns.json'un ham (raw) adresi. Depo herkese aciktir.
    private const val URL_STR =
        "https://raw.githubusercontent.com/gundogar2424/gorev-yonetim-sistemi/main/karttakip-android/campaigns.json"
    private const val PREFS = "campaigns"
    private const val KEY_JSON = "json"

    private val tr = Locale("tr", "TR")

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
        return CampaignData(o.optString("updated"), o.optString("note"), list)
    }

    /** Bu kampanya bu karta uygun mu? (kart adi/bankasi, match anahtarlarini iceriyorsa) */
    fun matches(card: Card, c: Campaign): Boolean {
        val hay = (card.name + " " + card.bank).lowercase(tr)
        return c.match.any { it.isNotBlank() && hay.contains(it) }
    }
}
