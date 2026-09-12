// SESLI REHBER: cumleleri ve nokta adlarini sesli okur. Uc motor:
//   1) telefon: APK'da yerel TextToSpeech eklentisi (Android'in kendi motoru)
//   2) web:     tarayicida Web Speech API
//   3) yedek:   uygulamaya gomulu Turkce ses (meSpeak) — motor yoksa, Turkce
//               bilmiyorsa ya da hata verirse KENDILIGINDEN devreye girer
// Ayarlar > Ses motoru: otomatik / telefon / yedek. Teshis icin diagnose().
import { Capacitor } from '@capacitor/core'
import { readSettings } from './store'
import { fallbackReady, fallbackSpeak, getFallbackError, stopFallback } from './fallbackTts'

type Done = () => void
type NativeTts = typeof import('@capacitor-community/text-to-speech').TextToSpeech
export type Engine = 'telefon' | 'web' | 'yedek'

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
let lastEngine: Engine | null = null
let lastError = ''
let nativeLang: string | null | undefined // undefined: henuz bakilmadi, null: Turkce yok

function webSupported(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  } catch {
    return false
  }
}

export function speechSupported(): boolean {
  return true // yedek motor her yerde calisir
}

export function getLastEngine(): Engine | null {
  return lastEngine
}
export function getLastError(): string {
  return lastError
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Telefon motorunda Turkce hangi etiketle var? ('tr-TR' > 'tr' > 'tr-*'); yoksa null.
async function resolveNativeLang(t: NativeTts): Promise<string | null> {
  if (nativeLang !== undefined) return nativeLang
  for (let i = 0; i < 6; i++) {
    try {
      if ((await t.isLanguageSupported({ lang: 'tr-TR' })).supported) return (nativeLang = 'tr-TR')
      if ((await t.isLanguageSupported({ lang: 'tr' })).supported) return (nativeLang = 'tr')
      const langs = (await t.getSupportedLanguages()).languages
      const tr = langs.find((l) => l.toLowerCase().startsWith('tr'))
      return (nativeLang = tr ?? null)
    } catch (e) {
      lastError = String((e as Error)?.message ?? e)
      // Motor henuz hazir degilse biraz bekle ve yeniden dene
      await sleep(600)
    }
  }
  return null // karar verme; bir sonraki cagrida yeniden denenir
}

// Sesler bazi cihazlarda gec yuklenir; motorlari onceden isit.
export function warmUpVoices(): void {
  try {
    const eng = readSettings().voiceEngine
    if (Capacitor.isNativePlatform() && eng !== 'yedek') {
      void native().then((t) => t && resolveNativeLang(t))
    }
    if (!Capacitor.isNativePlatform() && webSupported()) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }
    if (eng === 'yedek' || eng === 'auto') void fallbackReady()
  } catch {
    /* yok say */
  }
}

export function stopSpeaking(): void {
  seq++
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = null
  try {
    stopFallback()
    if (Capacitor.isNativePlatform()) void native().then((t) => t?.stop().catch(() => {}))
    else if (webSupported()) window.speechSynthesis.cancel()
  } catch {
    /* yok say */
  }
}

// Onceki okumayi keser, yenisini okur. onDone bir kez cagrilir: okuma bitince,
// ya da hicbir motor calismadiysa kullanicinin cumleyi kendi okuyabilecegi
// tahmini sure sonra.
export function speak(text: string, onDone?: Done): boolean {
  const s = readSettings()
  if (!s.voice || !text.trim()) return false
  stopSpeaking()
  const my = ++seq
  const rate = rateValue()
  const est = estimateMs(text, rate)
  const started = Date.now()
  let done = false
  const finish = (spoke: boolean) => {
    if (done || my !== seq) return
    done = true
    if (fallbackTimer) clearTimeout(fallbackTimer)
    fallbackTimer = null
    const elapsed = Date.now() - started
    if (!spoke || (elapsed < 700 && text.trim().split(/\s+/).length > 3)) {
      fallbackTimer = setTimeout(() => {
        if (my === seq) onDone?.()
      }, Math.max(0, est - elapsed))
    } else onDone?.()
  }

  const viaFallback = async (): Promise<boolean> => {
    const ok = await fallbackSpeak(text, s.voiceRate, () => finish(true))
    if (ok) lastEngine = 'yedek'
    return ok
  }

  const viaNative = async (): Promise<boolean> => {
    const t = await native()
    if (!t) {
      lastError = 'Eklenti yüklenemedi'
      return false
    }
    const lang = await resolveNativeLang(t)
    if (!lang) {
      lastError = lastError || 'Telefonda Türkçe okuma sesi yok'
      return false
    }
    for (let i = 0; i < 4; i++) {
      if (my !== seq) return true
      try {
        lastEngine = 'telefon'
        await t.speak({ text, lang, rate, pitch: 1, volume: 1, queueStrategy: 0 })
        return true
      } catch (e) {
        lastError = String((e as Error)?.message ?? e)
        if (/initialized|available/i.test(lastError)) {
          await sleep(700) // motor henuz hazir degil; kisa bekleyip yeniden dene
          continue
        }
        return false
      }
    }
    return false
  }

  const viaWeb = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (!webSupported()) return resolve(false)
      const v = turkishWebVoice()
      if (!v) return resolve(false) // Turkce ses yoksa yedek motora birak
      try {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'tr-TR'
        u.voice = v
        u.rate = rate
        u.pitch = 1
        let ended = false
        u.onend = () => {
          ended = true
          resolve(true)
        }
        u.onerror = () => resolve(false)
        lastEngine = 'web'
        window.speechSynthesis.speak(u)
        setTimeout(() => {
          if (!ended) resolve(true)
        }, est)
      } catch {
        resolve(false)
      }
    })

  void (async () => {
    const pref = s.voiceEngine
    let ok = false
    if (pref === 'yedek') ok = await viaFallback()
    else {
      if (Capacitor.isNativePlatform()) ok = await viaNative()
      else ok = await viaWeb()
      if (ok && lastEngine !== 'yedek') {
        finish(true)
        return
      }
      if (!ok && pref === 'auto' && my === seq) ok = await viaFallback()
    }
    if (!ok) finish(false)
    // yedek motor calindiysa 'onended' finish(true) cagirir
  })()

  // Hicbir motor yanit vermezse tahmini sure + pay sonra devam et
  fallbackTimer = setTimeout(() => finish(false), est + 6000)
  return true
}

export interface Diag {
  platform: 'apk' | 'web'
  nativeReady: boolean
  nativeTurkish: string | null
  nativeLanguages: string[]
  webTurkish: boolean
  fallbackReady: boolean
  lastEngine: Engine | null
  lastError: string
}

export async function diagnose(): Promise<Diag> {
  const d: Diag = {
    platform: Capacitor.isNativePlatform() ? 'apk' : 'web',
    nativeReady: false,
    nativeTurkish: null,
    nativeLanguages: [],
    webTurkish: false,
    fallbackReady: false,
    lastEngine,
    lastError
  }
  try {
    if (d.platform === 'apk') {
      const t = await native()
      if (t) {
        try {
          d.nativeLanguages = (await t.getSupportedLanguages()).languages
          d.nativeReady = true
        } catch (e) {
          d.lastError = String((e as Error)?.message ?? e)
        }
        nativeLang = undefined
        d.nativeTurkish = await resolveNativeLang(t)
      }
    } else if (webSupported()) {
      d.webTurkish = !!turkishWebVoice()
    }
    d.fallbackReady = !!(await fallbackReady())
    if (!d.fallbackReady && getFallbackError()) d.lastError = 'Yedek ses: ' + getFallbackError()
  } catch (e) {
    d.lastError = String((e as Error)?.message ?? e)
  }
  d.lastEngine = lastEngine
  d.lastError = d.lastError || lastError
  return d
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
