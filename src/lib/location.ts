// Google Haritalar konum cozumleme.
// Yapistirilan metinden (koordinat veya harita baglantisi) enlem/boylam cikarir.
import type { GpsPoint } from '../types'
import { Capacitor } from '@capacitor/core'

function valid(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

// Metinden koordinat cikarma denemeleri (oncelik sirasiyla)
export function parseLocationText(input: string): GpsPoint | null {
  const text = input.trim()
  if (!text) return null

  // 1) Duz "enlem, boylam" veya "enlem boylam"
  const plain = text.match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/)
  if (plain) {
    const lat = num(plain[1])
    const lng = num(plain[2])
    if (valid(lat, lng)) return { lat, lng }
  }

  // 2) URL icinde @enlem,boylam  (ornek: /maps/place/...@41.0082,28.9784,17z)
  const at = text.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/)
  if (at) {
    const lat = num(at[1])
    const lng = num(at[2])
    if (valid(lat, lng)) return { lat, lng }
  }

  // 3) q=enlem,boylam veya query=... veya ll=... veye destination=...
  const q = text.match(/[?&](?:q|query|ll|destination|center|sll)=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/)
  if (q) {
    const lat = num(q[1])
    const lng = num(q[2])
    if (valid(lat, lng)) return { lat, lng }
  }

  // 4) Google'in dahili formati: !3dENLEM!4dBOYLAM
  const bang = text.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/)
  if (bang) {
    const lat = num(bang[1])
    const lng = num(bang[2])
    if (valid(lat, lng)) return { lat, lng }
  }

  // 5) geo: URI  (geo:41.0082,28.9784)
  const geo = text.match(/geo:(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i)
  if (geo) {
    const lat = num(geo[1])
    const lng = num(geo[2])
    if (valid(lat, lng)) return { lat, lng }
  }

  // 6) Etiketli JSON: "latitude":X ... "longitude":Y (iki sirada da) - GUVENLI
  const j1 = text.match(/"latitude"\s*:\s*(-?\d{1,2}\.\d+)[^}]{0,40}?"longitude"\s*:\s*(-?\d{1,3}\.\d+)/i)
  if (j1) {
    const lat = num(j1[1])
    const lng = num(j1[2])
    if (valid(lat, lng)) return { lat, lng }
  }
  const j2 = text.match(/"longitude"\s*:\s*(-?\d{1,3}\.\d+)[^}]{0,40}?"latitude"\s*:\s*(-?\d{1,2}\.\d+)/i)
  if (j2) {
    const lng = num(j2[1])
    const lat = num(j2[2])
    if (valid(lat, lng)) return { lat, lng }
  }

  return null
}

function num(s: string): number {
  return parseFloat(s.replace(',', '.'))
}

// Kisa link mi? (maps.app.goo.gl / goo.gl/maps)
export function isShortMapsLink(input: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(input)
}

export interface ResolveResult {
  point: GpsPoint | null
  // 'ok' = cozuldu, 'short-link' = kisa link cozulemedi, 'not-found' = anlasilmadi
  status: 'ok' | 'short-link' | 'not-found'
  // Teshis: native deneme sirasinda ne oldugu (hata/nihai URL ozeti)
  note?: string
}

// Senkron deneme: dogrudan metinden cozer.
export function resolveLocation(input: string): ResolveResult {
  const point = parseLocationText(input)
  if (point) return { point, status: 'ok' }
  if (isShortMapsLink(input)) return { point: null, status: 'short-link' }
  return { point: null, status: 'not-found' }
}

// Kisa linkten ilk URL'i ayikla
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/)
  return m ? m[0] : null
}

// Asenkron deneme: once dogrudan cozer; olmazsa kisa linki bir CORS-araci
// servis uzerinden acip (tarayici dogrudan acamaz) icindeki koordinati bulur.
// Internet gerektirir; basarisiz olursa 'short-link' doner.
export async function resolveLocationAsync(input: string): Promise<ResolveResult> {
  const direct = resolveLocation(input)
  if (direct.status !== 'short-link') return direct

  const url = extractUrl(input)
  if (!url) return { point: null, status: 'short-link' }

  // APK (native): Capacitor'in kendi HTTP katmani CORS engeline takilmaz;
  // kisa linki dogrudan acip icindeki koordinati bulabiliriz.
  let note = ''
  if (Capacitor.isNativePlatform()) {
    const r = await resolveNative(url)
    if (r.point) return { point: r.point, status: 'ok' }
    note = r.note
  }

  // Birkac araci servis sirayla denenir
  const proxies = [
    (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`
  ]

  for (const make of proxies) {
    try {
      const res = await fetchWithTimeout(make(url), 12000)
      if (!res.ok) continue
      const text = await res.text()
      // Hem nihai URL hem de sayfa icerigi koordinat barindirabilir
      const point = parseLocationText(text) ?? parseLocationText(decodeURIComponent(text))
      if (point) return { point, status: 'ok' }
    } catch {
      // bu araciyi atla, sonrakini dene
    }
  }
  return { point: null, status: 'short-link', note }
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t))
}

// Native (APK) icin: Capacitor HTTP ile kisa linki acip koordinat cikar.
// Tarayici CORS engeli burada gecerli degildir. Teshis icin 'note' doner.
async function resolveNative(url: string): Promise<{ point: GpsPoint | null; note: string }> {
  const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36'
  const headers = { 'User-Agent': UA, 'Accept-Language': 'tr,en', 'Accept-Encoding': 'identity' }
  const notes: string[] = []
  try {
    const { CapacitorHttp } = await import('@capacitor/core')

    // Bir URL'i ac, nihai URL + govdeden koordinat aramayi dene
    const tryUrl = async (u: string): Promise<GpsPoint | null> => {
      const res = await CapacitorHttp.get({ url: u, headers, responseType: 'text' })
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
      const finalUrl = (res as unknown as { url?: string }).url ?? ''
      notes.push(`HTTP ${res.status}${finalUrl ? ' → ' + finalUrl.slice(0, 80) : ''} (${body.length}b)`)
      const hay = `${finalUrl}\n${body}`
      // Google sayfayi kacisli (escaped) yazar: =, \/, !3d..!4d gizli kalir.
      // Ham + kacissiz + kod-cozulmus tum bicimlerde ararsak koordinati yakalariz.
      const unescaped = unescapeAll(hay)
      for (const candidate of [hay, unescaped, safeDecode(hay), safeDecode(unescaped)]) {
        const p = parseLocationText(candidate)
        if (p) return p
      }
      return null
    }

    // 1) Dogrudan (yonlendirmeler takip edilir)
    const p1 = await tryUrl(url)
    if (p1) return { point: p1, note: notes.join(' | ') }

    // 2) Yonlendirme basligindan hedef URL'i al, onu da dene
    const first = await CapacitorHttp.get({ url, disableRedirects: true, headers })
    const loc = (first.headers?.Location ?? first.headers?.location ?? '') as string
    if (loc) {
      notes.push(`Location: ${loc.slice(0, 80)}`)
      const pLoc = parseLocationText(loc) ?? parseLocationText(safeDecode(loc))
      if (pLoc) return { point: pLoc, note: notes.join(' | ') }
      const p2 = await tryUrl(loc)
      if (p2) return { point: p2, note: notes.join(' | ') }
    } else {
      notes.push('Location bos')
    }
  } catch (e) {
    notes.push('hata: ' + (e instanceof Error ? e.message : String(e)))
  }
  return { point: null, note: notes.join(' | ') }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

// Google HTML/JSON kacislarini coz: = -> =, \/ -> /, \" -> " ...
// Boylece gizli !3d..!4d / @lat,lng / =lat,lng kaliplari ortaya cikar.
function unescapeAll(s: string): string {
  let out = s
  try {
    out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  } catch {
    /* yoksay */
  }
  out = out.replace(/\\\//g, '/').replace(/\\"/g, '"')
  out = out.replace(/&amp;/gi, '&') // HTML entity -> & (center= yakalansin)
  // Kodlanmis virgul: staticmap "center=LAT%2CLNG" -> "center=LAT,LNG"
  // (center= sirasi lat,lng olarak belli; guvenli)
  out = out.replace(/%2C/gi, ',')
  return out
}
