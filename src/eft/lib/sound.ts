// Kisa geri bildirim sesleri (WebAudio ile uretilir; ses dosyasi yok) + titresim.
import { readSettings } from './store'
import { audioCtx } from './audioCtx'

const audio = audioCtx

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, when = 0): void {
  const c = audio()
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

// Her vurusta: yumusak, kisa "tik" + cok kisa titresim
export function sfxTick(): void {
  const s = readSettings()
  if (s.sound) tone(740, 0.045, 'sine', 0.05)
  vibrate(12)
}

// Nokta degisince: biraz daha belirgin, iki notali
export function sfxPoint(): void {
  if (readSettings().sound) {
    tone(523, 0.08, 'sine', 0.08)
    tone(659, 0.12, 'sine', 0.08, 0.07)
  }
  vibrate([20, 30, 20])
}

// Tur / seans bitince
export function sfxDone(): void {
  if (readSettings().sound) {
    tone(523, 0.12, 'sine', 0.1)
    tone(659, 0.12, 'sine', 0.1, 0.12)
    tone(784, 0.3, 'sine', 0.12, 0.24)
  }
  vibrate([30, 40, 60])
}

// Ayarlarda ses acilinca ornek
export function sfxSample(): void {
  tone(660, 0.1, 'sine', 0.1)
  tone(880, 0.14, 'sine', 0.1, 0.09)
}
