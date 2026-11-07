package com.karttakip.app.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Kullanicinin "Takip et" dedigi bir kampanya ve ilerlemesi.
 * targetSpend: sarti saglamak icin gereken toplam harcama (₺). 0 = hedef yok.
 * spentSoFar : kullanicinin bu kampanyaya bagladigi toplam harcama (₺).
 * deadlineEpochDay: son tarih (0 = yok).
 */
@Entity(tableName = "tracked_campaigns")
data class TrackedCampaign(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val reward: String = "",
    val targetSpend: Double = 0.0,
    val spentSoFar: Double = 0.0,
    val deadlineEpochDay: Long = 0,
    val note: String = "",
    val completed: Boolean = false,
    // Bankadan kampanyaya katilindi mi? (Katilmadan harcama saymaz.)
    val joined: Boolean = false,
    val url: String = ""
)

@Dao
interface TrackedCampaignDao {
    @Query("SELECT * FROM tracked_campaigns ORDER BY completed ASC, deadlineEpochDay ASC")
    fun observeAll(): Flow<List<TrackedCampaign>>

    @Query("SELECT * FROM tracked_campaigns")
    suspend fun getAll(): List<TrackedCampaign>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(c: TrackedCampaign): Long

    @Delete
    suspend fun delete(c: TrackedCampaign)
}
