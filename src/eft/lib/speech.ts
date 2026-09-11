// Sesli rehber: cumleleri ve nokta adlarini telefonun kendi Turkce metin
// okuma motoruyla okur.
//  - APK'da (Capacitor): yerel TextToSpeech eklentisi. Android WebView web
//    tabanli speechSynthesis'i DESTEKLEMEDIGI icin bu sart (aksi halde ses
//    cikmiyor).
//  - Tarayicida: Web Speech API (speechSynthesis).
// Ses dosyasi yok, internet gerekmez. Turkce ses yoksa sistem varsayilanina
// duser; Ayarlar'dan Turkce ses verisi yukleme ekrani acilabilir.
import { Capacitor } from '@capacitor/core'
import { readSettings } from './store'

type Done = () => void
type NativeTts = typeof import('@capacitor-community/text-to-speech').TextToSpeech

let nativeP: Promise<NativeTts | null> | null = null
function native(): Promise<NativeTts | null> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null)
  if (!nativeP) {
    nativeP = import('@capacitor-community/text-to-speech')
      .then((m) => m.TextToSpeech)
      .catch(() => null)
  }
  return nativeP
}

// Her yeni okuma bir oncekini gecersiz kilar (gec gelen 'bitti' cagrilari
// yanlis adimi ilerletmesin diye sira numarasi tutulur).
let seq = 0
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

function webSupported(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  } catch {
    return false
  }
}

export function speechSupported(): boolean {
  return Capacitor.isNativePlatform() || webSupported()
}

function rateValue(): number {
  return readSettings().voiceRate === 'yavas' ? 0.82 : 0.95
}

// Tahmini okuma suresi: kelime basina ~0.45 sn (+1.5 sn pay)
function estimateMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1500, (words * 450) / rate + 1500)
}

function turkishWebVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices()
    const tr = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('tr'))
    if (tr.length === 0) return null
    return tr.find((v) => /google|natural|neural/i.test(v.name)) ?? tr.find((v) => v.localService) ?? tr[0]
  } catch {
    return null
  }
}

// Sesler bazi cihazlarda gec yuklenir; listeyi onceden tetikle.
export function warmUpVoices(): void {
  try {
    if (Capacitor.isNativePlatform()) {
      void native()
      return
    }
    if (!webSupported()) return
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  } catch {
    /* yok say */
  }
}

export function stopSpeaking(): void {
  seq++
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = null
  try {
    if (Capacitor.isNativePlatform()) void native().then((t) => t?.stop().catch(() => {}))
    else if (webSupported()) window.speechSynthesis.cancel()
  } catch {
    /* yok say */
  }
}

// Onceki okumayi keser, yenisini okur. onDone bir kez cagrilir: okuma bitince,
// ya da okuma hemen bitmis/hata vermisse (ornegin Turkce ses yok) kullanicinin
// cumleyi kendi okuyup soyleyebilecegi tahmini sure sonra.
export function speak(text: string, onDone?: Done): boolean {
  const s = readSettings()
  if (!s.voice || !speechSupported() || !text.trim()) return false
  stopSpeaking()
  const my = ++seq
  const rate = rateValue()
  const est = estimateMs(text, rate)
  const started = Date.now()
  let done = false
  const finish = () => {
    if (done || my !== seq) return
    done = true
    if (fallbackTimer) clearTimeout(fallbackTimer)
    fallbackTimer = null
    const elapsed = Date.now() - started
    const words = text.trim().split(/\s+/).length
    if (elapsed < 700 && words > 3) {
      fallbackTimer = setTimeout(() => {
        if (my === seq) onDone?.()
      }, est - elapsed)
    } else onDone?.()
  }

  if (Capacitor.isNativePlatform()) {
    void native().then(async (t) => {
      if (my !== seq) return
      if (!t) {
        finish()
        return
      }
      try {
        await t.speak({ text, lang: 'tr-TR', rate, pitch: 1, volume: 1, category: 'ambient', queueStrategy: 1 })
      } catch {
        /* dil yok ya da motor hatasi: finish tahmini sureyi uygular */
      }
      finish()
    })
    // Eklenti hic yanit vermezse tahmini sure + pay sonra devam et
    fallbackTimer = setTimeout(finish, est + 4000)
    return true
  }

  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'tr-TR'
    const v = turkishWebVoice()
    if (v) u.voice = v
    u.rate = rate
    u.pitch = 1
    u.onend = finish
    u.onerror = finish
    window.speechSynthesis.speak(u)
    fallbackTimer = setTimeout(finish, est)
    return true
  } catch {
    onDone?.()
    return false
  }
}

// Turkce ses var mi? ('bilinmiyor': web ya da eklenti sorgulanamadi)
export async function turkishAvailable(): Promise<'var' | 'yok' | 'bilinmiyor'> {
  try {
    if (Capacitor.isNativePlatform()) {
      const t = await native()
      if (!t) return 'bilinmiyor'
      const r = await t.isLanguageSupported({ lang: 'tr-TR' })
      if (r.supported) return 'var'
      const langs = await t.getSupportedLanguages()
      return langs.languages.some((l) => l.toLowerCase().startsWith('tr')) ? 'var' : 'yok'
    }
    if (!webSupported()) return 'yok'
    return turkishWebVoice() ? 'var' : 'bilinmiyor'
  } catch {
    return 'bilinmiyor'
  }
}

// Android'de metin okuma verisi yukleme ekranini acar (Turkce ses yoksa)
export async function openTtsInstall(): Promise<boolean> {
  try {
    const t = await native()
    if (!t) return false
    await t.openInstall()
    return true
  } catch {
    return false
  }
}
