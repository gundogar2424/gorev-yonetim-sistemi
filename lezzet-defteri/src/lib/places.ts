// GOOGLE PLACES (yeni API): mekanin Google Haritalar'daki kesin kaydi —
// adres, konum, puan, yorum sayisi ve yorumlar sayfasi. Anahtar yalnizca
// bu cihazda saklanir. Anahtar yoksa uygulama yapay zeka aramasiyla devam eder.

const KEY = 'lz-places-key'
const KOK = 'https://places.googleapis.com/v1'
// Yalnizca gereken alanlar istenir (ucret istenen alanlara gore belirlenir)
const ALANLAR = ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'googleMapsUri', 'primaryTypeDisplayName', 'priceLevel']

export function placesAnahtari(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
export function placesAnahtariKaydet(v: string): void {
  try {
    const t = v.trim().replace(/[\s"'“”]/g, '')
    if (t) localStorage.setItem(KEY, t)
    else localStorage.removeItem(KEY)
  } catch {
    /* yok */
  }
}

export interface GoogleMekan {
  id: string
  ad: string
  adres: string
  lat: number
  lon: number
  puan: number
  yorumSayisi: number
  haritaUrl: string
  tur: string
  fiyat: string // ₺ / ₺₺ / ₺₺₺ / ₺₺₺₺
}

interface HamYer {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  primaryTypeDisplayName?: { text: string }
  priceLevel?: string
}

const FIYAT: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: '₺',
  PRICE_LEVEL_MODERATE: '₺₺',
  PRICE_LEVEL_EXPENSIVE: '₺₺₺',
  PRICE_LEVEL_VERY_EXPENSIVE: '₺₺₺₺'
}

function cevir(y: HamYer): GoogleMekan {
  return {
    id: y.id,
    ad: y.displayName?.text ?? '',
    adres: y.formattedAddress ?? '',
    lat: y.location?.latitude ?? 0,
    lon: y.location?.longitude ?? 0,
    puan: y.rating ?? 0,
    yorumSayisi: y.userRatingCount ?? 0,
    haritaUrl: y.googleMapsUri ?? '',
    tur: y.primaryTypeDisplayName?.text ?? '',
    fiyat: y.priceLevel ? (FIYAT[y.priceLevel] ?? '') : ''
  }
}

async function istek(yol: string, yontem: 'GET' | 'POST', alanlar: string, govde?: unknown): Promise<unknown> {
  const anahtar = placesAnahtari()
  if (!anahtar) throw new Error('Google Haritalar anahtarı girilmemiş.')
  let r: Response
  try {
    r = await fetch(`${KOK}/${yol}`, {
      method: yontem,
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': anahtar, 'X-Goog-FieldMask': alanlar },
      body: govde ? JSON.stringify(govde) : undefined
    })
  } catch {
    throw new Error('Google Haritalar’a bağlanılamadı. İnterneti kontrol et.')
  }
  const metin = await r.text()
  if (!r.ok) {
    let m = ''
    try {
      m = (JSON.parse(metin) as { error?: { message?: string } }).error?.message ?? ''
    } catch {
      /* yok */
    }
    if (/API key not valid|API_KEY_INVALID/i.test(m)) throw new Error('Google Haritalar anahtarı geçersiz; Ayarlar’dan yeniden kopyala.')
    if (/not been used|disabled|SERVICE_DISABLED/i.test(m)) throw new Error('Bu anahtarın projesinde “Places API (New)” açık değil. Google Cloud’da etkinleştir.')
    if (/billing/i.test(m)) throw new Error('Google Cloud projesinde faturalandırma açık değil.')
    if (r.status === 429) throw new Error('Google Haritalar kotası doldu; biraz sonra dene.')
    throw new Error(`Google Haritalar hatası (${r.status})${m ? `: ${m.slice(0, 120)}` : ''}`)
  }
  return JSON.parse(metin)
}

// Ad + semt ile mekani bulur (yakin konum biliniyorsa ona yakin olani tercih eder)
export async function googleMekanAra(sorgu: string, yakin?: { lat: number; lon: number }): Promise<GoogleMekan | undefined> {
  const j = (await istek('places:searchText', 'POST', ALANLAR.map((a) => `places.${a}`).join(','), {
    textQuery: sorgu,
    languageCode: 'tr',
    maxResultCount: 3,
    ...(yakin && (yakin.lat || yakin.lon)
      ? { locationBias: { circle: { center: { latitude: yakin.lat, longitude: yakin.lon }, radius: 20000 } } }
      : {})
  })) as { places?: HamYer[] }
  const y = j.places?.[0]
  return y ? cevir(y) : undefined
}

// Kayitli mekanin guncel puani (kimligi biliniyorsa)
export async function googleMekanGetir(id: string): Promise<GoogleMekan> {
  return cevir((await istek(`places/${encodeURIComponent(id)}`, 'GET', ALANLAR.join(','))) as HamYer)
}

// Ayarlar'daki "Dene" dugmesi
export async function placesTest(): Promise<string> {
  const m = await googleMekanAra('Galata Kulesi İstanbul')
  return m ? `✓ Google Haritalar çalışıyor (${m.ad}${m.puan ? `, ⭐ ${m.puan}` : ''})` : '✓ Anahtar çalışıyor'
}
