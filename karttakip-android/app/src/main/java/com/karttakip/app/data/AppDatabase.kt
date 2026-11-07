package com.karttakip.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [Card::class, TrackedCampaign::class], version = 10, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun cardDao(): CardDao
    abstract fun trackedCampaignDao(): TrackedCampaignDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        // v2 -> v3: "ödedim" takibi icin yeni sutun. Veri KORUNUR.
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE cards ADD COLUMN lastPaidDueEpochDay INTEGER NOT NULL DEFAULT 0")
            }
        }

        // v3 -> v4: ekstre borcu (bu ay odenecek) ayri sutun. Veri KORUNUR.
        private val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE cards ADD COLUMN statementDebt REAL NOT NULL DEFAULT 0")
            }
        }

        // v4 -> v5: ekstre giris takibi (yanip sonme) icin sutun. Veri KORUNUR.
        private val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE cards ADD COLUMN ekstreForStatementEpochDay INTEGER NOT NULL DEFAULT 0")
            }
        }

        // v5 -> v6: ekstre onay isaretini sifirla. Boylece kesim gecmis ama ekstre
        // borcu girilmemis mevcut kartlar guncellemeden sonra yanip sonmeye baslar.
        // Diger veriler (limit, borc, tarihler) KORUNUR.
        private val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("UPDATE cards SET ekstreForStatementEpochDay = 0")
            }
        }

        // v6 -> v7: takip edilen kampanyalar tablosu. Diger veriler KORUNUR.
        private val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `tracked_campaigns` (" +
                        "`id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, " +
                        "`title` TEXT NOT NULL, " +
                        "`reward` TEXT NOT NULL, " +
                        "`targetSpend` REAL NOT NULL, " +
                        "`spentSoFar` REAL NOT NULL, " +
                        "`deadlineEpochDay` INTEGER NOT NULL, " +
                        "`note` TEXT NOT NULL, " +
                        "`completed` INTEGER NOT NULL, " +
                        "`url` TEXT NOT NULL)"
                )
            }
        }

        // v7 -> v8: kampanyaya "katildim" durumu. Diger veriler KORUNUR.
        private val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE tracked_campaigns ADD COLUMN joined INTEGER NOT NULL DEFAULT 0")
            }
        }

        // v8 -> v9: kartta guncel puan/TL bakiyesi + guncelleme tarihi. Veri KORUNUR.
        private val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE cards ADD COLUMN points REAL NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE cards ADD COLUMN pointsUpdatedEpochDay INTEGER NOT NULL DEFAULT 0")
            }
        }

        // v9 -> v10: takip edilen kampanya hangi karta bagli (cardId). Veri KORUNUR.
        private val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE tracked_campaigns ADD COLUMN cardId INTEGER NOT NULL DEFAULT 0")
            }
        }

        fun get(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "karttakip.db"
                )
                    .addMigrations(MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7, MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10)
                    // Bilinmeyen bir surumden gelirse son care: yeniden olustur.
                    .fallbackToDestructiveMigration()
                    .build().also { INSTANCE = it }
            }
    }
}
