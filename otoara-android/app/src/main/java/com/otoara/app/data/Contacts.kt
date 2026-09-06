package com.otoara.app.data

import android.content.Context
import android.provider.ContactsContract.CommonDataKinds.Phone
import java.util.Locale

/** Rehberdeki bir numara (ve "Cep / İş / Ev" gibi etiketi). */
data class PhoneNumber(val number: String, val typeLabel: String)

/** Rehberdeki bir kişi — numaralari tekrarsiz. */
data class ContactEntry(val name: String, val numbers: List<PhoneNumber>)

/**
 * Rehberi okur ve **tekrarlari eleyerek** kisi listesine cevirir.
 *
 * Sistemin kendi secme ekrani numaralari listeler; bir kisi birden fazla
 * hesapta kayitliysa (Google, SIM, WhatsApp...) ya da birkac numarasi varsa
 * ayni isim alt alta defalarca cikar. Burada:
 *
 *  - Ayni isimdeki kayitlar tek satirda toplanir,
 *  - Ayni numara (bosluk/ulke kodu farklari onemsenmeden) bir kez alinir.
 */
object ContactsRepo {

    fun load(context: Context): List<ContactEntry> {
        val names = LinkedHashMap<String, String>()
        val numbers = LinkedHashMap<String, MutableList<PhoneNumber>>()
        val seen = HashMap<String, MutableSet<String>>()

        val projection = arrayOf(
            Phone.DISPLAY_NAME,
            Phone.NUMBER,
            Phone.TYPE,
            Phone.LABEL
        )

        context.contentResolver.query(
            Phone.CONTENT_URI,
            projection,
            null,
            null,
            "${Phone.DISPLAY_NAME} COLLATE LOCALIZED ASC"
        )?.use { c ->
            while (c.moveToNext()) {
                val raw = c.getString(1)?.trim().orEmpty()
                if (raw.isEmpty()) continue

                val name = c.getString(0)?.trim().orEmpty().ifEmpty { raw }
                val key = name.lowercase(Locale("tr"))

                // Ayni kisideki ayni numara tekrar eklenmesin.
                if (!seen.getOrPut(key) { mutableSetOf() }.add(normalize(raw))) continue

                val label = Phone.getTypeLabel(
                    context.resources, c.getInt(2), c.getString(3)
                ).toString()

                names[key] = name
                numbers.getOrPut(key) { mutableListOf() }.add(PhoneNumber(raw, label))
            }
        }

        return names.map { (key, name) ->
            ContactEntry(name, numbers[key].orEmpty())
        }.sortedBy { it.name.lowercase(Locale("tr")) }
    }

    /** Numaralari karsilastirmak icin: sadece rakamlar, son 9 hane. */
    private fun normalize(raw: String): String {
        val digits = raw.filter { it.isDigit() }
        return if (digits.length > 9) digits.takeLast(9) else digits
    }
}
