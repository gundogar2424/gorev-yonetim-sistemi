package com.karttakip.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.karttakip.app.data.AppDatabase
import com.karttakip.app.data.BackupIO
import com.karttakip.app.data.Card
import com.karttakip.app.data.TrackedCampaign
import com.karttakip.app.notif.NotificationScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class CardViewModel(app: Application) : AndroidViewModel(app) {
    private val dao = AppDatabase.get(app).cardDao()
    private val trackedDao = AppDatabase.get(app).trackedCampaignDao()

    val cards: StateFlow<List<Card>> = dao.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Takip edilen kampanyalar. */
    val tracked: StateFlow<List<TrackedCampaign>> = trackedDao.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Bir kampanyayi takibe al (hedef harcama + son tarih ile). */
    fun track(c: TrackedCampaign) {
        viewModelScope.launch(Dispatchers.IO) {
            trackedDao.upsert(c)
            NotificationScheduler.scheduleAll(getApplication())
        }
    }

    /** Takip edilen kampanyaya harcama ekle (ilerleme). */
    fun addSpend(c: TrackedCampaign, amount: Double) {
        if (amount <= 0.0) return
        viewModelScope.launch(Dispatchers.IO) {
            trackedDao.upsert(c.copy(spentSoFar = (c.spentSoFar + amount).coerceAtLeast(0.0)))
            NotificationScheduler.scheduleAll(getApplication())
        }
    }

    /** Kampanyayi tamamlandi isaretle (uyarilar durur). */
    fun completeTracked(c: TrackedCampaign) {
        viewModelScope.launch(Dispatchers.IO) {
            NotificationScheduler.cancelCampaign(getApplication(), c.id)
            trackedDao.upsert(c.copy(completed = true))
            NotificationScheduler.scheduleAll(getApplication())
        }
    }

    fun deleteTracked(c: TrackedCampaign) {
        viewModelScope.launch(Dispatchers.IO) {
            NotificationScheduler.cancelCampaign(getApplication(), c.id)
            trackedDao.delete(c)
            NotificationScheduler.scheduleAll(getApplication())
        }
    }

    fun save(card: Card, onDone: () -> Unit = {}) {
        viewModelScope.launch(Dispatchers.IO) {
            dao.upsert(card)
            NotificationScheduler.scheduleAll(getApplication())
            launch(Dispatchers.Main) { onDone() }
        }
    }

    fun delete(card: Card, onDone: () -> Unit = {}) {
        viewModelScope.launch(Dispatchers.IO) {
            dao.delete(card)
            NotificationScheduler.scheduleAll(getApplication())
            launch(Dispatchers.Main) { onDone() }
        }
    }

    /**
     * "Borç yok" — kesim gecmis ama borc girilmemis karttaki yanip sonmeyi,
     * borc girmeden kapatir. Ekstre borcu 0 kalir, bu dongu "gorüldü" isaretlenir.
     */
    fun markNoStatement(card: Card) {
        viewModelScope.launch(Dispatchers.IO) {
            dao.upsert(
                card.copy(
                    statementDebt = 0.0,
                    ekstreForStatementEpochDay = java.time.LocalDate.now().toEpochDay()
                )
            )
            NotificationScheduler.scheduleAll(getApplication())
        }
    }

    suspend fun getById(id: Long): Card? = dao.getById(id)

    /** Yedek metnini (JSON) okuyup kartlari ekler. onResult'a eklenen kart sayisini verir (hata -> -1). */
    fun importCards(text: String, onResult: (Int) -> Unit) {
        viewModelScope.launch(Dispatchers.IO) {
            val count = try {
                val cards = BackupIO.parse(text)
                cards.forEach { dao.upsert(it) }
                NotificationScheduler.scheduleAll(getApplication())
                cards.size
            } catch (e: Exception) {
                -1
            }
            launch(Dispatchers.Main) { onResult(count) }
        }
    }

    /** Mevcut kartlari yedek JSON metnine cevirir. */
    suspend fun exportJson(): String = BackupIO.toJson(dao.getAll())
}
