package com.otoara.app.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface AttemptDao {

    @Insert
    suspend fun insert(attempt: Attempt): Long

    @Query("SELECT * FROM attempts ORDER BY startedAt DESC LIMIT 500")
    fun recent(): Flow<List<Attempt>>

    @Query("DELETE FROM attempts")
    suspend fun clear()
}

@Dao
interface TargetDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(target: Target)

    @Query("SELECT * FROM targets ORDER BY lastUsedAt DESC LIMIT 20")
    fun recent(): Flow<List<Target>>

    @Query("DELETE FROM targets WHERE number = :number")
    suspend fun delete(number: String)
}

@Dao
interface PlanDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(plan: Plan): Long

    @Update
    suspend fun update(plan: Plan)

    @Delete
    suspend fun delete(plan: Plan)

    @Query("SELECT * FROM plans ORDER BY timeAt ASC")
    fun all(): Flow<List<Plan>>

    @Query("SELECT * FROM plans")
    suspend fun allOnce(): List<Plan>

    @Query("SELECT * FROM plans WHERE id = :id")
    suspend fun byId(id: Long): Plan?
}
