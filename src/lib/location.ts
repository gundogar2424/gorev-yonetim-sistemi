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
  if (Capacitor.isNativePlatform()) {
    const p = await resolveNative(url)
    if (p) return { point: p, status: 'ok' }
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
  return { point: null, status: 'short-link' }
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t))
}

// Native (APK) icin: Capacitor HTTP ile kisa linki acip koordinat cikar.
// Tarayici CORS engeli burada gecerli degildir.
async function resolveNative(url: string): Promise<GpsPoint | null> {
  const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile'
  try {
    const { CapacitorHttp } = await import('@capacitor/core')

    // 1) Yonlendirmeleri takip et; nihai URL + sayfa icerigini tara
    const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': UA } })
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
    const finalUrl = (res as unknown as { url?: string }).url ?? ''
    const hay1 = `${finalUrl}\n${body}`
    const p1 = parseLocationText(hay1) ?? parseLocationText(safeDecode(hay1))
    if (p1) return p1

    // 2) Yonlendirme basligindan (Location) hedef URL'i al
    const first = await CapacitorHttp.get({ url, disableRedirects: true, headers: { 'User-Agent': UA } })
    const loc = (first.headers?.Location ?? first.headers?.location ?? '') as string
    if (loc) {
      const pLoc = parseLocationText(loc) ?? parseLocationText(safeDecode(loc))
      if (pLoc) return pLoc
      // Location baska bir URL ise onu da bir kez daha ac
      const res2 = await CapacitorHttp.get({ url: loc, headers: { 'User-Agent': UA } })
      const body2 = typeof res2.data === 'string' ? res2.data : ''
      const finalUrl2 = (res2 as unknown as { url?: string }).url ?? ''
      const hay2 = `${finalUrl2}\n${body2}`
      const p2 = parseLocationText(hay2) ?? parseLocationText(safeDecode(hay2))
      if (p2) return p2
    }
  } catch {
    // sessizce basarisiz; disaridaki araci-servis denemesine dusulur
  }
  return null
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
