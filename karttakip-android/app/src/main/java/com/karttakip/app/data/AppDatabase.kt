package com.karttakip.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [Card::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun cardDao(): CardDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "karttakip.db"
                )
                    // Gun-tabanli eski semadan tarih-tabanli yeni semaya gecis;
                    // veri az oldugu icin yeniden olusturulur (yedekten tekrar aktarilabilir).
                    .fallbackToDestructiveMigration()
                    .build().also { INSTANCE = it }
            }
    }
}
