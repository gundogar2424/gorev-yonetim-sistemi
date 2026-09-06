package com.otoara.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [Attempt::class, Target::class, Plan::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun attemptDao(): AttemptDao
    abstract fun targetDao(): TargetDao
    abstract fun planDao(): PlanDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                "otoara.db"
            ).fallbackToDestructiveMigration().build().also { instance = it }
        }
    }
}
