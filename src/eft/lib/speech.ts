// Sesli rehber: cumleleri ve nokta adlarini cihazin kendi sesiyle okur
// (Web Speech API, Android WebView'da Google TTS ile calisir). Ses dosyasi
// yok, internet gerekmez. Turkce ses yoksa sistem varsayilanina duser.
import { readSettings } from './store'

type Done = () => void

let current: SpeechSynthesisUtterance | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

export function speechSupported(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  } catch {
    return false
  }
}

function turkishVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices()
    const tr = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('tr'))
    if (tr.length === 0) return null
    // Google/dogal olan varsa onu tercih et
    return tr.find((v) => /google|natural|neural/i.test(v.name)) ?? tr.find((v) => v.localService) ?? tr[0]
  } catch {
    return null
  }
}

// Sesler bazi cihazlarda gec yuklenir; listeyi onceden tetikle.
export function warmUpVoices(): void {
  try {
    if (!speechSupported()) return
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  } catch {
    /* yok say */
  }
}

export function stopSpeaking(): void {
  try {
    if (fallbackTimer) clearTimeout(fallbackTimer)
    fallbackTimer = null
    current = null
    if (speechSupported()) window.speechSynthesis.cancel()
  } catch {
    /* yok say */
  }
}

// Onceki okumayi keser, yenisini okur. onDone bir kez cagrilir (okuma bitince
// ya da bazi WebView'larda 'end' olayi gelmezse tahmini sureden sonra).
export function speak(text: string, onDone?: Done): boolean {
  const s = readSettings()
  if (!s.voice || !speechSupported() || !text.trim()) return false
  stopSpeaking()
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'tr-TR'
    const v = turkishVoice()
    if (v) u.voice = v
    u.rate = s.voiceRate === 'yavas' ? 0.82 : 0.95
    u.pitch = 1
    let done = false
    const started = Date.now()
    const words = text.trim().split(/\s+/).length
    // Tahmini okuma suresi: kelime basina ~0.45 sn (+1.5 sn pay)
    const est = Math.max(1500, (words * 450) / u.rate + 1500)
    const finish = () => {
      if (done) return
      done = true
      if (fallbackTimer) clearTimeout(fallbackTimer)
      fallbackTimer = null
      if (current === u) current = null
      // Ses hemen bitti/hata verdiyse (ornegin Turkce ses yok), kullaniciya
      // yine de cumleyi okuyup soyleyecek kadar sure tani.
      const elapsed = Date.now() - started
      if (elapsed < 700 && words > 3) setTimeout(() => onDone?.(), est - elapsed)
      else onDone?.()
    }
    u.onend = finish
    u.onerror = finish
    current = u
    window.speechSynthesis.speak(u)
    // 'end' olayi gelmezse tahmini sureden sonra bitir
    fallbackTimer = setTimeout(finish, est)
    return true
  } catch {
    onDone?.()
    return false
  }
}

export function isSpeaking(): boolean {
  try {
    return speechSupported() && window.speechSynthesis.speaking
  } catch {
    return false
  }
}
