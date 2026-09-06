package com.seslipdf.app.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface DocDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(doc: Doc): Long

    @Update
    suspend fun update(doc: Doc)

    @Delete
    suspend fun delete(doc: Doc)

    @Query("SELECT * FROM docs ORDER BY lastOpenedAt DESC, addedAt DESC")
    fun all(): Flow<List<Doc>>

    @Query("SELECT * FROM docs WHERE id = :id")
    fun flowById(id: Long): Flow<Doc?>

    @Query("SELECT * FROM docs WHERE id = :id")
    suspend fun byId(id: Long): Doc?

    @Query("SELECT * FROM docs WHERE uri = :uri LIMIT 1")
    suspend fun byUri(uri: String): Doc?

    @Query("UPDATE docs SET position = :position WHERE id = :id")
    suspend fun setPosition(id: Long, position: Int)

    @Query("UPDATE docs SET lastOpenedAt = :at WHERE id = :id")
    suspend fun touch(id: Long, at: Long)

    @Query("UPDATE docs SET status = :status, note = :note WHERE id = :id")
    suspend fun setStatus(id: Long, status: String, note: String)
}
