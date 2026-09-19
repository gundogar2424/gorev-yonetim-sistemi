// Konusma tanima ile DOGRULUK PUANI. Soylenen metin yaziya cevrilir, hedef
// metinle sozcuk sozcuk hizalanir; % dogruluk, dakikadaki sozcuk (WPM) ve
// yutulan / yanlis sozcukler bulunur.
//
// - APK (Android): @capacitor-community/speech-recognition eklentisi
//   (telefonun kendi Turkce konusma tanimasi; Google'in cevrimdisi Turkce
//   paketi yuklüyse internetsiz de calisir).
// - Web: tarayicinin Web Speech API'si varsa (Chrome) o kullanilir.
// Ses KAYDEDILMEZ; yalnizca tanima sonucu (metin) islenir.
import { Capacitor } from '@capacitor/core'

export type SpeechStatus = 'yok' | 'hazir' | 'dinliyor' | 'izin-yok'

export interface SpeechResult {
  text: string // taninan metin (en olasi aday)
  ms: number // dinleme suresi
}

interface WebRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

function webCtor(): (new () => WebRecognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

// Cihazda konusma tanima var mi?
export async function speechAvailable(): Promise<boolean> {
  try {
    if (isNative()) {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
      const r = await SpeechRecognition.available()
      return !!r.available
    }
    return !!webCtor()
  } catch {
    return false
  }
}

export async function speechPermission(): Promise<boolean> {
  try {
    if (!isNative()) return true // web: tarayici kendisi sorar
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    const cur = await SpeechRecognition.checkPermissions()
    if (cur.speechRecognition === 'granted') return true
    const req = await SpeechRecognition.requestPermissions()
    return req.speechRecognition === 'granted'
  } catch {
    return false
  }
}

// Tek satirlik dinleme: baslar, kullanici durdurana ya da tanima kendiliginden
// bitene kadar dinler. Donen nesne ile durdurulur.
export interface Listener {
  done: Promise<SpeechResult>
  stop: () => void
}

export async function listenOnce(): Promise<Listener> {
  const t0 = Date.now()
  if (isNative()) {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    let best = ''
    let stopped = false
    let resolveFn: (r: SpeechResult) => void = () => {}
    const done = new Promise<SpeechResult>((res) => {
      resolveFn = res
    })
    await SpeechRecognition.removeAllListeners()
    await SpeechRecognition.addListener('partialResults', (d) => {
      if (d.matches?.[0]) best = d.matches[0]
    })
    await SpeechRecognition.addListener('listeningState', (d) => {
      if (d.status === 'stopped' && !stopped) {
        stopped = true
        resolveFn({ text: best, ms: Date.now() - t0 })
      }
    })
    // partialResults=true: start() hemen doner, sonuclar olaydan gelir.
    void SpeechRecognition.start({ language: 'tr-TR', maxResults: 3, partialResults: true, popup: false })
      .then((r) => {
        if (r?.matches?.[0]) best = r.matches[0]
      })
      .catch(() => {
        if (!stopped) {
          stopped = true
          resolveFn({ text: best, ms: Date.now() - t0 })
        }
      })
    return {
      done,
      stop: () => {
        void SpeechRecognition.stop().catch(() => {})
        // Bazi cihazlarda listeningState gelmez; kisa bekleyip kendimiz bitirelim
        setTimeout(() => {
          if (!stopped) {
            stopped = true
            resolveFn({ text: best, ms: Date.now() - t0 })
          }
        }, 1200)
      }
    }
  }
  const C = webCtor()
  if (!C) throw new Error('Bu tarayıcıda konuşma tanıma yok.')
  const rec = new C()
  rec.lang = 'tr-TR'
  rec.continuous = true
  rec.interimResults = true
  rec.maxAlternatives = 1
  let finalText = ''
  let interim = ''
  let resolveFn: (r: SpeechResult) => void = () => {}
  const done = new Promise<SpeechResult>((res) => {
    resolveFn = res
  })
  rec.onresult = (ev) => {
    finalText = ''
    interim = ''
    for (let i = 0; i < ev.results.length; i++) {
      const r = ev.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean }
      if (r.isFinal) finalText += ' ' + r[0].transcript
      else interim += ' ' + r[0].transcript
    }
  }
  rec.onerror = () => {
    /* onend gelir */
  }
  rec.onend = () => resolveFn({ text: (finalText + ' ' + interim).trim(), ms: Date.now() - t0 })
  rec.start()
  return { done, stop: () => rec.stop() }
}

// ---------------- PUANLAMA ----------------
export interface WordMark {
  w: string
  ok: boolean // hedefteki sozcuk dogru soylendi mi
}

export interface Score {
  accuracy: number // 0..100
  wpm: number // dakikadaki sozcuk (soylenen)
  marks: WordMark[] // hedef metnin sozcukleri, dogru/yanlis
  heard: string // taninan metin
  extra: number // fazladan/yanlis eklenen sozcuk sayisi
}

// Turkce'ye gore kucuk harf, noktalama disari, ayraclari (…) at.
export function normalizeTr(s: string): string[] {
  return s
    .replace(/\(.*?\)/g, ' ') // "(soru — sonu yükselsin)" gibi yonergeleri at
    .replace(/^[A-ZÇĞİÖŞÜ]+:\s*/u, '') // "KALEMLE: " / "YAVAŞ: " on eklerini at
    .toLocaleLowerCase('tr')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[’'`]/g, '')
    .replace(/[^a-zçğıiöşü0-9\s]/giu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

// Iki sozcugun "yeterince benzer" sayilmasi: tanima kucuk hatalar yapar
// (ör. "berbere" -> "berber e"). Levenshtein orani 0.75 ustu = ayni.
function similar(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 3) return false
  const d = lev(a, b)
  return 1 - d / Math.max(a.length, b.length) >= 0.75
}

function lev(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[n]
}

// Sozcuk duzeyinde hizalama (Levenshtein, geri izleme ile): hedefteki her
// sozcuk icin eslesme var mi?
export function scoreText(target: string, heard: string, ms: number): Score {
  const T = normalizeTr(target)
  const H = normalizeTr(heard)
  const m = T.length
  const n = H.length
  if (m === 0) return { accuracy: 0, wpm: 0, marks: [], heard, extra: n }
  // dp[i][j] = T[0..i) ile H[0..j) arasindaki en az duzenleme
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const eq = similar(T[i - 1], H[j - 1]) ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + eq)
    }
  }
  // geri izleme
  const marks: WordMark[] = new Array(m)
  let i = m
  let j = n
  let extra = 0
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (similar(T[i - 1], H[j - 1]) ? 0 : 1)) {
      marks[i - 1] = { w: T[i - 1], ok: similar(T[i - 1], H[j - 1]) }
      i--
      j--
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      marks[i - 1] = { w: T[i - 1], ok: false } // yutulmus
      i--
    } else {
      extra++ // fazladan soylenen
      j--
    }
  }
  const ok = marks.filter((x) => x.ok).length
  const accuracy = Math.round((ok / m) * 100)
  const wpm = ms > 0 ? Math.round((n / ms) * 60000) : 0
  return { accuracy, wpm, marks, heard, extra }
}

export function accuracyComment(acc: number): string {
  if (acc >= 95) return 'Mükemmel, her sözcük net anlaşıldı 👏'
  if (acc >= 85) return 'Çok iyi; birkaç sözcük belirsiz kaldı.'
  if (acc >= 70) return 'İyi; işaretli sözcükleri daha yavaş ve net söyle.'
  if (acc >= 50) return 'Orta; tempoyu yavaşlat, her heceyi ayrı ver.'
  return 'Zor bir satır. Yavaş tempoda, sözcük sözcük tekrar dene.'
}
