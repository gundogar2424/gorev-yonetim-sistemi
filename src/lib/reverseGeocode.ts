// Koordinattan il/ilce bulma (reverse geocoding) - OpenStreetMap Nominatim.
// Ucretsizdir; native'de CapacitorHttp, web'de fetch kullanilir.
import type { GpsPoint } from '../types'
import { Capacitor } from '@capacitor/core'

export interface GeoResult {
  il: string
  ilceCandidates: string[]
}

export async function reverseGeocode(gps: GpsPoint): Promise<GeoResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${gps.lat}&lon=${gps.lng}&addressdetails=1&accept-language=tr`
  try {
    const json = (await fetchJson(url)) as { address?: Record<string, string> } | null
    const a = json && json.address
    if (!a) return null
    const il: string = a.province || a.state || a.city || ''
    if (!il) return null
    // Ilce farkli alanlarda gelebilir; hepsini aday olarak topla
    const ilceCandidates: string[] = [
      a.county,
      a.town,
      a.city_district,
      a.district,
      a.municipality,
      a.suburb,
      a.village,
      a.city
    ].filter((x): x is string => typeof x === 'string' && x.length > 0)
    return { il, ilceCandidates }
  } catch {
    return null
  }
}

async function fetchJson(url: string): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.get({
      url,
      headers: { 'User-Agent': 'SahaCRM/1.0 (saha-crm)', 'Accept-Language': 'tr' }
    })
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  }
  const r = await fetch(url, { headers: { 'Accept-Language': 'tr' } })
  return r.json()
}

// Turkce duyarli normallestirme (esleme icin): buyuk/kucuk + aksan farkini yok say
export function normTr(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/i̇/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
}
