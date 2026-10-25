package com.karttakip.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Bir kredi karti.
 *
 * - [statementEpochDay] : Kullanicinin sectigi hesap kesim TARIHI (epoch-day).
 * - [dueEpochDay]       : Kullanicinin sectigi son odeme TARIHI (epoch-day).
 *
 * Tarihler referanstir; uygulama gununu koruyarak her ay ileri tasir
 * (bkz. CardCalc.nextStatement / nextDue). Boylece kullanici "14 Agustos"
 * secince ekranda 14 Agustos gorunur, gun gectikce bir sonraki aya kayar.
 */
@Entity(tableName = "cards")
data class Card(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val bank: String = "",
    val statementEpochDay: Long,
    val dueEpochDay: Long,
    val limit: Double = 0.0,
    // Toplam borc = limit - kullanilabilir (taksitliler dahil tum kullanilan).
    val debt: Double = 0.0,
    // Ekstre borcu = bu ay ODENECEK tutar. Limitle BAGIMSIZDIR (kalani taksitte
    // olabilir). Hatirlatmalar ve "ödenecek" bu tutari gosterir.
    val statementDebt: Double = 0.0,
    val colorArgb: Long = 0xFF3B82F6,
    val remindDaysBefore: Int = 3,
    // Kullanicinin "ödedim" dedigi son son-odeme tarihi (epoch-day). Bu sayede
    // o dongu icin tekrar eden hatirlatma durur ve bir sonraki donguye gecilir.
    val lastPaidDueEpochDay: Long = 0
)
