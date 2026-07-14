package com.karttakip.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.karttakip.app.data.AppDatabase
import com.karttakip.app.data.Card
import com.karttakip.app.notif.NotificationScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class CardViewModel(app: Application) : AndroidViewModel(app) {
    private val dao = AppDatabase.get(app).cardDao()

    val cards: StateFlow<List<Card>> = dao.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

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

    suspend fun getById(id: Long): Card? = dao.getById(id)
}
