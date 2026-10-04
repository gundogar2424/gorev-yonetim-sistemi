// VIDEODAN TARIF.
//
// Cogu Instagram/TikTok tarifinde malzemeler aciklamada yazmaz: ya videoda
// SOYLENIR ya da ekranda YAZI olarak gecer. Bu modul videonun kendisinden
// bilgi toplar:
//  - YouTube: altyazi (otomatik altyazi dahil) + tam aciklama
//  - Instagram / TikTok / Facebook: video dosyasi telefona indirilir,
//      * belirli anlardan kareler alinir (ekrandaki yazilar yapay zekaya gider)
//      * ses, telefonun ICINDE calisan Whisper modeliyle yaziya cevrilir
//        (model ilk kullanimda bir kez indirilir, sonra internetsiz calisir)
// Toplanan her sey Claude'a verilir; o da duzenli tarife cevirir.
import type { LzPlatform } from '../types'

export type SesModeli = 'kapali' | 'base' | 'small'
const KEY_SES = 'lz-ses-model'

export const SES_MODELLERI: { id: SesModeli; ad: string; aciklama: string }[] = [
  { id: 'base', ad: 'Hızlı', aciklama: 'Bir kez ~80 MB indirilir; çoğu tarif videosu için yeterli.' },
  { id: 'small', ad: 'Daha doğru', aciklama: 'Bir kez ~250 MB indirilir; daha yavaş ama Türkçeyi daha iyi anlar.' },
  { id: 'kapali', ad: 'Kapalı', aciklama: 'Videodaki konuşma dinlenmez; yalnızca açıklama ve ekrandaki yazılar okunur.' }
]

export function sesModeli(): SesModeli {
  try {
    const v = localStorage.getItem(KEY_SES)
    if (v === 'kapali' || v === 'base' || v === 'small') return v
  } catch {
    /* yok say */
  }
  return 'base'
}
export function sesModeliKaydet(v: SesModeli): void {
  try {
    localStorage.setItem(KEY_SES, v)
  } catch {
    /* yok say */
  }
}

// --- Sayfadan video adresi -------------------------------------------------

function jsonKacisCoz(s: string): string {
  try {
    return JSON.parse(`"${s}"`)
  } catch {
    return s.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
  }
}

function htmlAmp(s: string): string {
  return s.replace(/&amp;/g, '&')
}

// Paylasim sayfasinin HTML'inde gecen dogrudan video dosyasi adresini bulur.
export function videoAdresiBul(html: string, platform: LzPlatform): string {
  if (!html) return ''
  const adaylar: string[] = []
  const meta = html.match(/<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]*content=["']([^"']+)["']/i)
  if (meta) adaylar.push(htmlAmp(meta[1]))
  const desenler =
    platform === 'tiktok'
      ? [/"playAddr":"([^"]+)"/, /"downloadAddr":"([^"]+)"/, /"play_addr":\{[^}]*"url_list":\["([^"]+)"/]
      : [/"video_url":"([^"]+)"/, /"playable_url_quality_hd":"([^"]+)"/, /"playable_url":"([^"]+)"/, /"contentUrl":"([^"]+\.mp4[^"]*)"/, /"video_versions":\[\{[^}]*"url":"([^"]+)"/]
  for (const d of desenler) {
    const m = html.match(d)
    if (m) adaylar.push(jsonKacisCoz(m[1]))
  }
  // Instagram gomme sayfasi veriyi bir JSON dizesinin ICINDE, iki kez kacisli
  // tutar: \"video_url\":\"https:\\/\\/...\". Once bir kat kacis cozulur.
  if (!adaylar.some((a) => /^https:\/\//.test(a)) && /\\"video_url\\"/.test(html)) {
    const m = html.match(/\\"video_url\\":\\"(.*?)\\"/)
    if (m) adaylar.push(jsonKacisCoz(jsonKacisCoz(m[1])))
  }
  return adaylar.find((a) => /^https:\/\//.test(a)) ?? ''
}

// --- Instagram herkese acik veri servisi ----------------------------------------
// Sayfa ve gomme sayfasi video adresini vermezse Instagram'in web sitesinin
// kendi kullandigi GraphQL sorgusu denenir (girissiz, herkese acik gonderiler).
export async function instagramVeri(kod: string): Promise<{ videoUrl: string; aciklama: string; kapak: string }> {
  const bos = { videoUrl: '', aciklama: '', kapak: '' }
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return bos
  const lsd = 'AVqbxe3J_YA'
  const form = new URLSearchParams({
    av: '0',
    lsd,
    doc_id: '8845758582119845',
    variables: JSON.stringify({ shortcode: kod, fetch_tagged_user_count: null, hoisted_comment_id: null, hoisted_reply_id: null })
  }).toString()
  try {
    const r = await CapacitorHttp.post({
      url: 'https://www.instagram.com/graphql/query',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
        'X-IG-App-ID': '936619743392459',
        'X-FB-LSD': lsd,
        'X-ASBD-ID': '129477',
        'Sec-Fetch-Site': 'same-origin',
        Referer: `https://www.instagram.com/reel/${kod}/`
      },
      data: form
    })
    const j = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as {
      data?: { xdt_shortcode_media?: { video_url?: string; display_url?: string; edge_media_to_caption?: { edges?: { node?: { text?: string } }[] } } }
    }
    const m = j?.data?.xdt_shortcode_media
    if (!m) return bos
    return {
      videoUrl: m.video_url ?? '',
      aciklama: m.edge_media_to_caption?.edges?.[0]?.node?.text ?? '',
      kapak: m.display_url ?? ''
    }
  } catch {
    return bos
  }
}

// --- YouTube ----------------------------------------------------------------

export interface YoutubeBilgi {
  aciklama: string
  altyazi: string
}

// Izleme sayfasindaki ytInitialPlayerResponse'tan tam aciklamayi ve altyazi
// adresini alir; altyaziyi (varsa Turkce, yoksa ilk dil) indirir.
export async function youtubeBilgi(html: string, indir: (url: string) => Promise<string>): Promise<YoutubeBilgi> {
  const sonuc: YoutubeBilgi = { aciklama: '', altyazi: '' }
  const acik = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
  if (acik) sonuc.aciklama = jsonKacisCoz(acik[1])

  const izler = html.match(/"captionTracks":(\[.*?\])(?:,"audioTracks"|,"translationLanguages"|\})/)
  if (!izler) return sonuc
  let liste: { baseUrl: string; languageCode: string; kind?: string }[] = []
  try {
    liste = JSON.parse(izler[1])
  } catch {
    return sonuc
  }
  const iz = liste.find((t) => t.languageCode === 'tr' && t.kind !== 'asr') ?? liste.find((t) => t.languageCode === 'tr') ?? liste[0]
  if (!iz?.baseUrl) return sonuc
  try {
    const ham = await indir(jsonKacisCoz(iz.baseUrl) + '&fmt=json3')
    const j = JSON.parse(ham) as { events?: { segs?: { utf8?: string }[] }[] }
    sonuc.altyazi = (j.events ?? [])
      .map((e) => (e.segs ?? []).map((s) => s.utf8 ?? '').join(''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    /* altyazi alinamadi — aciklama yine de kullanilir */
  }
  return sonuc
}

// --- Video indirme ------------------------------------------------------------

const EN_BUYUK_MB = 80

export async function videoIndir(url: string, sayfa: string): Promise<Blob> {
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({
      url,
      responseType: 'blob',
      // Takilan indirme sirayi kilitlemesin
      connectTimeout: 20000,
      readTimeout: 90000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
        Referer: sayfa,
        Accept: '*/*'
      }
    })
    if (r.status >= 400 || typeof r.data !== 'string' || !r.data) throw new Error('Video indirilemedi.')
    if (r.data.length > EN_BUYUK_MB * 1.37 * 1024 * 1024) throw new Error('Video çok büyük.')
    const b = await (await fetch(`data:video/mp4;base64,${r.data}`)).blob()
    return b
  }
  const r = await fetch(url, { referrer: sayfa, signal: AbortSignal.timeout(120000) })
  if (!r.ok) throw new Error('Video indirilemedi.')
  return r.blob()
}

// --- Kareler ------------------------------------------------------------------

function bekle(el: HTMLVideoElement, olay: string, ms = 8000): Promise<void> {
  return new Promise((res, rej) => {
    const t = window.setTimeout(() => rej(new Error('Video açılamadı.')), ms)
    el.addEventListener(
      olay,
      () => {
        window.clearTimeout(t)
        res()
      },
      { once: true }
    )
    // Dosya bozuk / bicim desteklenmiyorsa zaman asimini beklemeden vazgec
    el.addEventListener(
      'error',
      () => {
        window.clearTimeout(t)
        rej(new Error('Video açılamadı.'))
      },
      { once: true }
    )
  })
}

// Videonun belirli anlarindan JPEG kareler alir (ekrandaki yazilar icin).
// Ilk kare ayrica kapak fotografi olarak kullanilabilir.
export async function kareler(video: Blob, adet = 8): Promise<{ kareler: string[]; sure: number }> {
  const url = URL.createObjectURL(video)
  const el = document.createElement('video')
  el.muted = true
  el.playsInline = true
  el.preload = 'auto'
  el.src = url
  try {
    await bekle(el, 'loadeddata', 15000)
    const sure = isFinite(el.duration) ? el.duration : 0
    const w = el.videoWidth || 720
    const h = el.videoHeight || 1280
    const oran = Math.min(1, 768 / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * oran)
    canvas.height = Math.round(h * oran)
    const ctx = canvas.getContext('2d')
    if (!ctx || !sure) return { kareler: [], sure }
    const cikti: string[] = []
    for (let i = 0; i < adet; i++) {
      // Bas ve son kisimlarda da yazi olabilir; araliklari esit dagit
      el.currentTime = Math.min(sure - 0.1, (sure * (i + 0.5)) / adet)
      await bekle(el, 'seeked')
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
      cikti.push(canvas.toDataURL('image/jpeg', 0.72))
    }
    return { kareler: cikti, sure }
  } finally {
    el.removeAttribute('src')
    el.load()
    URL.revokeObjectURL(url)
  }
}

// --- Konusmayi yaziya cevirme (cihaz icinde) ----------------------------------

const EN_UZUN_SN = 10 * 60

// Gemini'ye dogrudan (tek istekte) gonderilebilecek en buyuk video. Istek
// siniri 20 MB ve base64 dosyayi ~%33 buyuttugu icin ham 13 MB'ta tutulur.
export const GEMINI_DOGRUDAN_MAX = 13 * 1024 * 1024

// Videodaki sesi 16 kHz tek kanala cevirir (Whisper'in bekledigi bicim).
async function sesCoz(video: Blob): Promise<Float32Array> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const buf = await ctx.decodeAudioData(await video.arrayBuffer())
    const sure = Math.min(buf.duration, EN_UZUN_SN)
    const off = new OfflineAudioContext(1, Math.ceil(sure * 16000), 16000)
    const src = off.createBufferSource()
    src.buffer = buf
    src.connect(off.destination)
    src.start(0)
    const cikis = await off.startRendering()
    return cikis.getChannelData(0)
  } finally {
    void ctx.close()
  }
}

type Donusturucu = (ses: Float32Array, secenek: Record<string, unknown>) => Promise<{ text: string }>
let yuklu: { model: SesModeli; fn: Donusturucu } | null = null

export async function konusmayiYaziyaCevir(
  video: Blob,
  model: Exclude<SesModeli, 'kapali'>,
  ilerleme: (mesaj: string) => void
): Promise<string> {
  ilerleme('Videonun sesi hazırlanıyor…')
  let ses: Float32Array
  try {
    ses = await sesCoz(video)
  } catch {
    throw new Error('Videonun sesi okunamadı.')
  }
  // Neredeyse sessiz (yalnizca muzik yok sayilamaz ama tamamen sessizse bosuna calisma)
  let enYuksek = 0
  for (let i = 0; i < ses.length; i += 160) enYuksek = Math.max(enYuksek, Math.abs(ses[i]))
  if (enYuksek < 0.01) return ''

  if (!yuklu || yuklu.model !== model) {
    ilerleme('Ses modeli hazırlanıyor…')
    const { pipeline } = await import('@huggingface/transformers')
    const fn = (await pipeline('automatic-speech-recognition', `onnx-community/whisper-${model}`, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === 'progress_total' && typeof p.progress === 'number') {
          ilerleme(`Ses modeli indiriliyor (yalnızca ilk sefer) %${Math.round(p.progress)}`)
        }
      }
    }).catch(() => {
      throw new Error('ses modeli indirilemedi; internet bağlantını kontrol et')
    })) as unknown as Donusturucu
    yuklu = { model, fn }
  }
  ilerleme(`Konuşma yazıya çevriliyor (${Math.round(ses.length / 16000)} sn)…`)
  try {
    const r = await yuklu.fn(ses, { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
    return (r.text ?? '').trim()
  } catch {
    throw new Error('konuşma çözümlenemedi')
  }
}

// Videonun sesini 16 kHz tek kanal WAV (base64) olarak verir. Buyuk videolarda
// Gemini'ye videonun yerine kareler + bu ses gonderilir (5 dk ~ 9,6 MB).
export async function sesWavBase64(video: Blob, enUzunSn = 5 * 60): Promise<string> {
  const tam = await sesCoz(video)
  const ses = tam.subarray(0, Math.min(tam.length, enUzunSn * 16000))
  const veri = new DataView(new ArrayBuffer(44 + ses.length * 2))
  const yazS = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) veri.setUint8(o + i, t.charCodeAt(i))
  }
  yazS(0, 'RIFF')
  veri.setUint32(4, 36 + ses.length * 2, true)
  yazS(8, 'WAVE')
  yazS(12, 'fmt ')
  veri.setUint32(16, 16, true)
  veri.setUint16(20, 1, true) // PCM
  veri.setUint16(22, 1, true) // tek kanal
  veri.setUint32(24, 16000, true)
  veri.setUint32(28, 32000, true)
  veri.setUint16(32, 2, true)
  veri.setUint16(34, 16, true)
  yazS(36, 'data')
  veri.setUint32(40, ses.length * 2, true)
  for (let i = 0; i < ses.length; i++) {
    const v = Math.max(-1, Math.min(1, ses[i]))
    veri.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  const blob = new Blob([veri.buffer], { type: 'audio/wav' })
  return new Promise<string>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result).split(',')[1] ?? '')
    fr.onerror = () => rej(new Error('Ses hazırlanamadı.'))
    fr.readAsDataURL(blob)
  })
}
