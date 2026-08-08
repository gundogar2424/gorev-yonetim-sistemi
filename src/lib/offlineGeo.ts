// Cevrimdisi (internetsiz) koordinat -> il/ilce bulma.
// Turkiye il/ilce sinirlari uygulamaya gomulu; nokta-poligon testi ile calisir.
// Boylece internet olmasa da (ya da harita servisi cevap vermese de) il her zaman bulunur.
import type { GpsPoint } from '../types'
import type { GeoResult } from './reverseGeocode'

interface Feat {
  il: string
  ilce?: string
  bb: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
  r: number[][] // her halka: [lng,lat,lng,lat,...]
}
interface GeoData {
  provinces: Feat[]
  districts: Feat[]
}

let cache: GeoData | null = null
async function loadData(): Promise<GeoData> {
  if (cache) return cache
  // Ayri parca (chunk) olarak yuklenir; yalnizca konum cozumlenirken indirilir.
  const mod = await import('../data/turkeyGeo.json')
  cache = (mod.default ?? mod) as unknown as GeoData
  return cache
}

// Nokta bir halkanin icinde mi? (ray-casting, even-odd)
function pointInFlatRing(x: number, y: number, flat: number[]): boolean {
  let inside = false
  const n = flat.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[i * 2], yi = flat[i * 2 + 1]
    const xj = flat[j * 2], yj = flat[j * 2 + 1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}
function inFeat(x: number, y: number, f: Feat): boolean {
  if (x < f.bb[0] || x > f.bb[2] || y < f.bb[1] || y > f.bb[3]) return false
  let inside = false
  for (const ring of f.r) if (pointInFlatRing(x, y, ring)) inside = !inside
  return inside
}

// Cevrimdisi ters kodlama. il her zaman (Turkiye sinirlari icinde) bulunur.
export async function offlineReverseGeocode(gps: GpsPoint): Promise<GeoResult | null> {
  const data = await loadData()
  const x = gps.lng, y = gps.lat
  // Once ilce (il de birlikte gelir)
  for (const d of data.districts) {
    if (inFeat(x, y, d)) {
      return { il: d.il, ilceCandidates: d.ilce ? [d.ilce] : [] }
    }
  }
  // Ilce bulunamadiysa (sinir/gap): en azindan ili bul
  for (const p of data.provinces) {
    if (inFeat(x, y, p)) return { il: p.il, ilceCandidates: [] }
  }
  return null
}
