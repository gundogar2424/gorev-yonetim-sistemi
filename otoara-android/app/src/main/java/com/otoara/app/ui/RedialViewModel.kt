package com.otoara.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.otoara.app.data.AppDatabase
import com.otoara.app.data.Plan
import com.otoara.app.data.PlanRepeat
import com.otoara.app.data.Prefs
import com.otoara.app.data.RedialConfig
import com.otoara.app.data.Target
import com.otoara.app.plan.PlanScheduler
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * Ekrandaki form ve kayitlar. Her degisiklik aninda telefona yazilir; uygulama
 * kapanip acilinca ayni degerlerle gelir.
 */
class RedialViewModel(app: Application) : AndroidViewModel(app) {

    private val ctx = app
    private val prefs = Prefs(app)
    private val db = AppDatabase.get(app)

    var number by mutableStateOf(prefs.number)
        private set
    var extensionOn by mutableStateOf(prefs.extensionOn)
        private set
    var extension by mutableStateOf(prefs.extension)
        private set
    var interval by mutableStateOf(prefs.intervalSec.toString())
        private set
    var repeats by mutableStateOf(prefs.repeats.toString())
        private set
    var ringMin by mutableStateOf((prefs.ringSec / 60).toString())
        private set
    var ringSec by mutableStateOf((prefs.ringSec % 60).toString())
        private set
    var stopWhenAnswered by mutableStateOf(prefs.stopWhenAnswered)
        private set
    var hangUpOnTimeout by mutableStateOf(prefs.hangUpOnTimeout)
        private set
    var speaker by mutableStateOf(prefs.speaker)
        private set

    /** Kisilerden secilen numaranin adi (varsa) — gecmiste gorunur. */
    var label by mutableStateOf("")
        private set

    val history = db.attemptDao().recent()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val targets = db.targetDao().recent()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val plans = db.planDao().all()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateNumber(v: String, name: String = label) {
        number = v.take(24)
        label = name
        prefs.number = number
    }

    fun updateExtensionOn(v: Boolean) { extensionOn = v; prefs.extensionOn = v }
    fun updateExtension(v: String) { extension = v.take(12); prefs.extension = extension }
    fun updateInterval(v: String) { interval = digits(v, 4); persist() }
    fun updateRepeats(v: String) { repeats = digits(v, 3); persist() }
    fun updateRingMin(v: String) { ringMin = digits(v, 2); persist() }
    fun updateRingSec(v: String) { ringSec = digits(v, 2); persist() }
    fun updateStopWhenAnswered(v: Boolean) { stopWhenAnswered = v; prefs.stopWhenAnswered = v }
    fun updateHangUpOnTimeout(v: Boolean) { hangUpOnTimeout = v; prefs.hangUpOnTimeout = v }
    fun updateSpeaker(v: Boolean) { speaker = v; prefs.speaker = v }

    private fun digits(v: String, max: Int) = v.filter { it.isDigit() }.take(max)

    private fun persist() {
        prefs.intervalSec = interval.toIntOrNull() ?: 30
        prefs.repeats = repeats.toIntOrNull() ?: 10
        prefs.ringSec = totalRingSec()
    }

    private fun totalRingSec(): Int =
        (ringMin.toIntOrNull() ?: 0) * 60 + (ringSec.toIntOrNull() ?: 0)

    /** Formdaki degerlerden calistirilabilir bir ayar seti uretir. */
    fun config(): RedialConfig = RedialConfig(
        number = number.trim(),
        extension = if (extensionOn) extension.trim() else "",
        intervalSec = interval.toIntOrNull() ?: 30,
        repeats = repeats.toIntOrNull() ?: 10,
        ringSec = totalRingSec().let { if (it <= 0) 30 else it },
        stopWhenAnswered = stopWhenAnswered,
        hangUpOnTimeout = hangUpOnTimeout,
        speaker = speaker
    ).sanitized()

    /** Formda eksik/hatali bir sey varsa aciklamasini doner, yoksa null. */
    fun validate(): String? {
        val digitsOnly = number.filter { it.isDigit() }
        if (digitsOnly.length < 3) return "Geçerli bir hedef numara girin."
        if (extensionOn && extension.filter { it.isDigit() }.isEmpty()) {
            return "Dahili numarayı girin ya da seçeneği kapatın."
        }
        if ((repeats.toIntOrNull() ?: 0) < 1) return "Tekrar sayısı en az 1 olmalı."
        if ((interval.toIntOrNull() ?: 0) < RedialConfig.MIN_INTERVAL) {
            return "Aralık en az ${RedialConfig.MIN_INTERVAL} saniye olabilir."
        }
        if (totalRingSec() < RedialConfig.MIN_RING) {
            return "Çağrı süresi en az ${RedialConfig.MIN_RING} saniye olmalı."
        }
        return null
    }

    fun rememberTarget() = viewModelScope.launch {
        val n = number.trim()
        if (n.isNotBlank()) {
            db.targetDao().upsert(Target(n, label, System.currentTimeMillis()))
        }
    }

    fun deleteTarget(number: String) = viewModelScope.launch {
        db.targetDao().delete(number)
    }

    fun clearHistory() = viewModelScope.launch { db.attemptDao().clear() }

    // ------------------------------------------------------- planli aramalar

    /** Duzenlenen planin kimligi; 0 ise yeni plan. */
    var planId by mutableStateOf(0L)
        private set
    var planNumber by mutableStateOf("")
        private set
    var planLabel by mutableStateOf("")
        private set
    var planNote by mutableStateOf("")
        private set
    var planTime by mutableStateOf(defaultPlanTime())
        private set
    var planRepeat by mutableStateOf(PlanRepeat.ONCE)
        private set
    /** Form acik mi (liste yerine form gosterilir). */
    var planFormOpen by mutableStateOf(false)
        private set
    /** Rehberden secilen numara plana mi gidecek, ana ekrana mi. */
    var pickingForPlan by mutableStateOf(false)
        private set

    fun newPlan() {
        planId = 0
        planNumber = number.trim()
        planLabel = label
        planNote = ""
        planTime = defaultPlanTime()
        planRepeat = PlanRepeat.ONCE
        planFormOpen = true
    }

    fun editPlan(plan: Plan) {
        planId = plan.id
        planNumber = plan.number
        planLabel = plan.label
        planNote = plan.note
        planTime = plan.timeAt
        planRepeat = plan.repeat
        planFormOpen = true
    }

    fun closePlanForm() { planFormOpen = false; pickingForPlan = false }

    fun updatePlanNumber(v: String, name: String = planLabel) {
        planNumber = v.take(24)
        planLabel = name
    }

    fun updatePlanNote(v: String) { planNote = v.take(120) }
    fun updatePlanTime(v: Long) { planTime = v }
    fun updatePlanRepeat(v: String) { planRepeat = v }
    fun updatePickingForPlan(v: Boolean) { pickingForPlan = v }

    /** Formdaki eksigi anlatir, sorun yoksa null. */
    fun validatePlan(): String? {
        if (planNumber.filter { it.isDigit() }.length < 3) return "Geçerli bir numara girin."
        if (planTime <= System.currentTimeMillis() && planRepeat == PlanRepeat.ONCE) {
            return "Geçmiş bir tarih seçilemez."
        }
        return null
    }

    fun savePlan() = viewModelScope.launch {
        val dao = db.planDao()
        val plan = Plan(
            id = planId,
            number = planNumber.trim(),
            label = planLabel,
            note = planNote.trim(),
            timeAt = planTime,
            repeat = planRepeat,
            enabled = true
        )
        val saved = if (planId == 0L) plan.copy(id = dao.insert(plan)) else { dao.update(plan); plan }
        PlanScheduler.schedule(ctx, saved)
        planFormOpen = false
        pickingForPlan = false
    }

    fun deletePlan(plan: Plan) = viewModelScope.launch {
        PlanScheduler.cancel(ctx, plan.id)
        db.planDao().delete(plan)
    }

    fun togglePlan(plan: Plan, enabled: Boolean) = viewModelScope.launch {
        val updated = plan.copy(enabled = enabled)
        db.planDao().update(updated)
        if (enabled) PlanScheduler.schedule(ctx, updated)
        else PlanScheduler.cancel(ctx, plan.id)
    }

    /** Varsayilan plan zamani: bir sonraki tam saat. */
    private fun defaultPlanTime(): Long = Calendar.getInstance().apply {
        add(Calendar.HOUR_OF_DAY, 1)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}
