package com.otoara.app.call

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class Phase { IDLE, DIALING, IN_CALL, WAITING, PAUSED, FINISHED }

/**
 * Servisin canli durumu. Servis yazar, ekran okur; boylece uygulama kapatilip
 * tekrar acilsa bile dongunun nerede oldugu gorunur.
 */
data class RedialStatus(
    val running: Boolean = false,
    val number: String = "",
    val tryNo: Int = 0,
    val total: Int = 0,
    val phase: Phase = Phase.IDLE,
    /** Icinde bulunulan asamada kalan saniye (bekleme / cagri suresi). */
    val secondsLeft: Int = 0,
    /** Son denemenin sonucu (AttemptResult kodu). */
    val lastResult: String? = null,
    /** Dongu bittiyse nedeni. */
    val finishedReason: String? = null,
    /**
     * Hoparlor istendiyse gercekten acilabildi mi.
     * null = hoparlor istenmedi ya da henuz denenmedi.
     */
    val speakerOn: Boolean? = null
)

object RedialState {
    private val _status = MutableStateFlow(RedialStatus())
    val status: StateFlow<RedialStatus> = _status

    fun update(block: (RedialStatus) -> RedialStatus) {
        _status.value = block(_status.value)
    }

    fun set(status: RedialStatus) {
        _status.value = status
    }
}
