// Kisa geri bildirim sesleri (WebAudio ile uretilir; ses dosyasi yok) + titresim.
import { readSettings } from './store'
import { audioCtx } from './audioCtx'

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, when = 0): void {
  const c = audioCtx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, c.currentTime + when)
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + when + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + when)
  o.stop(c.currentTime + when + dur + 0.02)
}

function vibrate(pattern: number | number[]): void {
  try {
    if (readSettings().vibrate && navigator.vibrate) navigator.vibrate(pattern)
  } catch {
    /* yok say */
  }
}

// Geri sayim tiki (3-2-1)
export function sfxTick(): void {
  if (readSettings().sound) tone(660, 0.06, 'sine', 0.07)
  vibrate(15)
}

// "Simdi!" — tekrar basliyor
export function sfxGo(): void {
  if (readSettings().sound) tone(880, 0.16, 'sine', 0.12)
  vibrate([25, 20, 25])
}

// Tekrar bitti / dinlen
export function sfxRest(): void {
  if (readSettings().sound) tone(523, 0.12, 'sine', 0.08)
  vibrate(20)
}

// Egzersiz / seans bitti
export function sfxDone(): void {
  if (readSettings().sound) {
    tone(523, 0.12, 'sine', 0.1)
    tone(659, 0.12, 'sine', 0.1, 0.12)
    tone(784, 0.3, 'sine', 0.12, 0.24)
  }
  vibrate([30, 40, 60])
}

// Ayarlarda ornek
export function sfxSample(): void {
  tone(660, 0.1, 'sine', 0.1)
  tone(880, 0.14, 'sine', 0.1, 0.09)
}
