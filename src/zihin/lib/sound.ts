// Kisa geri bildirim sesleri (WebAudio ile uretilir; ses dosyasi yok) + titresim.
import { readSettings } from './store'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

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

export function sfxTap(): void {
  if (readSettings().sound) tone(520, 0.06, 'sine', 0.06)
}

export function sfxCorrect(): void {
  if (readSettings().sound) {
    tone(660, 0.1, 'sine', 0.1)
    tone(880, 0.14, 'sine', 0.1, 0.09)
  }
  vibrate(20)
}

export function sfxWrong(): void {
  if (readSettings().sound) tone(180, 0.22, 'triangle', 0.12)
  vibrate([40, 40, 40])
}

export function sfxWin(): void {
  if (readSettings().sound) {
    tone(523, 0.12, 'sine', 0.1)
    tone(659, 0.12, 'sine', 0.1, 0.12)
    tone(784, 0.12, 'sine', 0.1, 0.24)
    tone(1047, 0.3, 'sine', 0.12, 0.36)
  }
  vibrate([30, 40, 30, 40, 60])
}

// Sira Takibi oyununda her renk icin farkli nota
export function sfxNote(index: number): void {
  if (!readSettings().sound) return
  const notes = [392, 494, 587, 698, 784, 880]
  tone(notes[index % notes.length], 0.32, 'sine', 0.12)
}
