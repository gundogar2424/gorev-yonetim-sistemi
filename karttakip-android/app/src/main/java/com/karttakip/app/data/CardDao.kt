package com.karttakip.app.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CardDao {
    @Query("SELECT * FROM cards ORDER BY name COLLATE NOCASE")
    fun observeAll(): Flow<List<Card>>

    @Query("SELECT * FROM cards")
    suspend fun getAll(): List<Card>

    @Query("SELECT * FROM cards WHERE id = :id")
    suspend fun getById(id: Long): Card?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(card: Card): Long

    @Delete
    suspend fun delete(card: Card)
}
