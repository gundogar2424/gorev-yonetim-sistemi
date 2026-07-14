package com.karttakip.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Bir kredi karti.
 *
 * - [statementDay] : Hesap kesim gunu (ayin 1-31'i). Ekstre bu gun kapanir.
 * - [dueDay]       : Son odeme gunu (ayin 1-31'i).
 *
 * Ay o gunu icermiyorsa (or. 31 Subat) hesaplamada ayin son gunune kirpilir.
 */
@Entity(tableName = "cards")
data class Card(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val bank: String = "",
    val statementDay: Int,
    val dueDay: Int,
    val limit: Double = 0.0,
    val debt: Double = 0.0,
    val colorArgb: Long = 0xFF3B82F6,
    val remindDaysBefore: Int = 3
)
