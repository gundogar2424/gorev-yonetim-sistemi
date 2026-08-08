// Koordinattan il/ilce bulma (reverse geocoding) - OpenStreetMap Nominatim.
// Ucretsizdir; native'de CapacitorHttp, web'de fetch kullanilir.
import type { GpsPoint } from '../types'
import { Capacitor } from '@capacitor/core'

export interface GeoResult {
  il: string
  ilceCandidates: string[]
}

// Once CEVRIMDISI (internetsiz) gomulu sinir verisiyle bulunur -> il her zaman gelir,
// internet gerekmez, aninda calisir. Ilce cevrimdisi verilerde yoksa (buyuksehir
// merkez ilceleri gibi) cevrimici servislerle zenginlestirilmeye calisilir.
export async function reverseGeocode(gps: GpsPoint): Promise<GeoResult | null> {
  const { offlineReverseGeocode } = await import('./offlineGeo')
  const offline = await offlineReverseGeocode(gps)
  if (offline && offline.ilceCandidates.length > 0) return offline

  // Ilce cevrimdisi bulunamadi; cevrimici servislerden ilce almayi dene.
  const online = (await tryBigDataCloud(gps)) ?? (await tryNominatim(gps))
  if (online) {
    // Il'i cevrimdisi (guvenilir) sonuctan koru; ilce adaylarini cevrimiciden al.
    return { il: offline?.il || online.il, ilceCandidates: online.ilceCandidates }
  }
  return offline // en azindan il (cevrimdisi)
}

// BigDataCloud: client tarafi icin tasarlanmis ucretsiz servis
async function tryBigDataCloud(gps: GpsPoint): Promise<GeoResult | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${gps.lat}&longitude=${gps.lng}&localityLanguage=tr`
  try {
    const j = (await fetchJson(url)) as {
      principalSubdivision?: string
      city?: string
      locality?: string
      localityInfo?: { administrative?: { name?: string; adminLevel?: number }[]; informative?: { name?: string }[] }
    } | null
    if (!j) return null
    const admins = j.localityInfo?.administrative ?? []
    const byLevel = (lvl: number) => admins.find((a) => a.adminLevel === lvl)?.name
    const il = j.principalSubdivision || byLevel(4) || ''
    if (!il) return null
    const ilceCandidates = [
      byLevel(6),
      byLevel(5),
      j.city,
      j.locality,
      ...admins.map((a) => a.name),
      ...(j.localityInfo?.informative ?? []).map((a) => a.name)
    ].filter((x): x is string => typeof x === 'string' && x.length > 0)
    return { il, ilceCandidates }
  } catch {
    return null
  }
}

async function tryNominatim(gps: GpsPoint): Promise<GeoResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${gps.lat}&lon=${gps.lng}&addressdetails=1&accept-language=tr`
  try {
    const json = (await fetchJson(url)) as { address?: Record<string, string> } | null
    const a = json && json.address
    if (!a) return null
    const il: string = a.province || a.state || a.city || ''
    if (!il) return null
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

// Geocode sonucunu (il + ilce adaylari) uygulamanin il/ilce listesine (seed) esler.
// Donen il/ilce degerleri listedeki resmi yazimla ayni olur.
export interface SeedCityLike {
  name: string
  districts: string[]
}
export function matchToSeed(
  geo: GeoResult,
  cities: SeedCityLike[]
): { city: string; district: string } | null {
  const cityMatch = cities.find((c) => normTr(c.name) === normTr(geo.il))
  if (!cityMatch) return null
  let district = ''
  for (const cand of geo.ilceCandidates) {
    const dm = cityMatch.districts.find((d) => normTr(d) === normTr(cand))
    if (dm) {
      district = dm
      break
    }
  }
  return { city: cityMatch.name, district }
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
