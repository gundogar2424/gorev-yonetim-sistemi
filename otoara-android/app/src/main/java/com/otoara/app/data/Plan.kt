package com.otoara.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Calendar

/**
 * Planli arama: belirlenen tarih/saatte telefon "su numarayi arayacaktin"
 * diye sorar. Uygulama kendiliginden aramaz — karar her zaman kullanicinindir.
 */
@Entity(tableName = "plans")
data class Plan(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val number: String,
    /** Kisi adi (rehberden secildiyse). */
    val label: String = "",
    /** Nicin aranacagi — bildirimde gorunur. */
    val note: String = "",
    /** Ne zaman sorulacagi (epoch, milisaniye). */
    val timeAt: Long,
    /** [PlanRepeat] degerlerinden biri. */
    val repeat: String = PlanRepeat.ONCE,
    val enabled: Boolean = true
) {
    val title: String get() = if (label.isBlank()) number else label

    /**
     * Tekrarli planlarda bir sonraki zamani hesaplar; tek seferlikte null.
     * Gecmiste kalmis planlar icin ileriye dogru atlanir.
     */
    fun nextTime(after: Long = System.currentTimeMillis()): Long? {
        if (repeat == PlanRepeat.ONCE) return null
        val cal = Calendar.getInstance().apply { timeInMillis = timeAt }
        var guard = 0
        while (cal.timeInMillis <= after && guard < 1000) {
            when (repeat) {
                PlanRepeat.DAILY -> cal.add(Calendar.DAY_OF_MONTH, 1)
                PlanRepeat.WEEKLY -> cal.add(Calendar.WEEK_OF_YEAR, 1)
                PlanRepeat.MONTHLY -> cal.add(Calendar.MONTH, 1)
                else -> return null
            }
            guard++
        }
        return cal.timeInMillis
    }
}

object PlanRepeat {
    const val ONCE = "once"
    const val DAILY = "daily"
    const val WEEKLY = "weekly"
    const val MONTHLY = "monthly"

    val all = listOf(ONCE, DAILY, WEEKLY, MONTHLY)

    fun label(code: String) = when (code) {
        DAILY -> "Her gün"
        WEEKLY -> "Her hafta"
        MONTHLY -> "Her ay"
        else -> "Bir kez"
    }
}
