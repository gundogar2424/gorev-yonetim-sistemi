// Tarama: OSM + (varsa) Google sonuclarini birlestirir, populerlik (hype)
// puanini hesaplar, siralama/gruplama yardimcilarini sunar.
import { CATEGORIES } from './categories'
import { distanceM } from './geo'
import { fetchGoogle } from './google'
import { fetchOsm } from './osm'
import type { CategoryId, LatLng, Place, ScanResult, SortId } from './types'

export async function scan(center: LatLng, radiusM: number, googleKey: string): Promise<ScanResult> {
  const cats = CATEGORIES.map((c) => c.id)
  const warnings: string[] = []
  const [osmR, gR] = await Promise.allSettled([
    fetchOsm(center, radiusM, cats),
    googleKey ? fetchGoogle(googleKey, center, radiusM, cats) : Promise.resolve({ places: [], errors: [] })
  ])
  const osm = osmR.status === 'fulfilled' ? osmR.value : []
  if (osmR.status === 'rejected') warnings.push(String(osmR.reason instanceof Error ? osmR.reason.message : osmR.reason))
  const google = gR.status === 'fulfilled' ? gR.value.places : []
  if (gR.status === 'fulfilled' && gR.value.errors.length) warnings.push('Google: ' + gR.value.errors[0])
  if (gR.status === 'rejected') warnings.push('Google: ' + String(gR.reason))
  if (!osm.length && !google.length && warnings.length) throw new Error(warnings.join(' · '))

  const places = merge(osm, google).filter((p) => p.distanceM <= radiusM * 1.05)
  for (const p of places) p.hype = hypeScore(p)
  return { at: Date.now(), center, radiusM, places, googleUsed: !!googleKey && google.length > 0, warnings }
}

// Ayni yer iki kaynakta da varsa birlestir: Google kaydi esas alinir,
// OSM'deki instagram/wikipedia/calisma saati gibi bilgiler eklenir.
function merge(osm: Place[], google: Place[]): Place[] {
  const out: Place[] = []
  const seenG = new Set<string>()
  for (const g of google) {
    if (seenG.has(g.id)) continue // ayni yer iki kategoride donebilir
    seenG.add(g.id)
    out.push(g)
  }
  for (const o of osm) {
    const twin = out.find((g) => g.sources.includes('google') && !g.sources.includes('osm') && sameish(g, o))
    if (twin) {
      twin.sources.push('osm')
      twin.instagram ??= o.instagram
      twin.facebook ??= o.facebook
      twin.wikipedia ??= o.wikipedia
      twin.openingHours ??= o.openingHours
      twin.website ??= o.website
      twin.phone ??= o.phone
      // Google'in genel turu yerine OSM'nin mutfak bilgisi daha acik olabilir
      if (/^(Restoran|Restaurant)$/i.test(twin.subtype) && o.subtype !== 'Restoran') twin.subtype = o.subtype
    } else {
      out.push(o)
    }
  }
  return out
}

export function sameish(a: Place, b: Place): boolean {
  if (distanceM(a, b) > 90) return false
  const na = norm(a.name)
  const nb = norm(b.name)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

export function norm(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// POPULERLIK (HYPE) PUANI, 0-100 - TAHMINIDIR.
// Instagram/TikTok'un herkese acik bir "kac kisi konustu" verisi yok; bu
// yuzden en guclu vekil olarak Google yorum SAYISI kullanilir (cok konusulan
// yer cok yorum alir). Yanina sosyal medya/Wikipedia varligi eklenir.
export function hypeScore(p: Place): number {
  let s = 0
  if (p.ratingCount) {
    // 10 yorum ~ 19, 100 ~ 38, 1000 ~ 57, 5000+ ~ 70
    s += Math.min(70, (Math.log10(p.ratingCount + 1) / Math.log10(5000)) * 70)
    if (p.rating) s += Math.max(0, Math.min(1, (p.rating - 3.5) / 1.3)) * 15
  }
  if (p.wikipedia) s += p.ratingCount ? 5 : 40
  if (p.instagram) s += p.ratingCount ? 6 : 20
  if (p.facebook) s += p.ratingCount ? 2 : 6
  if (p.website) s += p.ratingCount ? 2 : 8
  if (!p.ratingCount && p.openingHours) s += 4
  return Math.round(Math.min(100, s))
}

export function hypeLabel(h: number): string {
  if (h >= 75) return 'Çok popüler'
  if (h >= 55) return 'Popüler'
  if (h >= 35) return 'Biliniyor'
  if (h >= 15) return 'Az bilinen'
  return 'Az veri'
}

export interface Filters {
  category: CategoryId | 'hepsi'
  subtype: string | null
  openOnly: boolean
  minRating: number // 0 = filtre yok
  query: string
}

export function applyFilters(places: Place[], f: Filters): Place[] {
  const q = norm(f.query)
  return places.filter(
    (p) =>
      (f.category === 'hepsi' || p.category === f.category) &&
      (!f.subtype || p.subtype === f.subtype) &&
      (!f.openOnly || p.openNow === true) &&
      (!f.minRating || (p.rating ?? 0) >= f.minRating) &&
      (!q || norm(p.name).includes(q) || norm(p.subtype).includes(q))
  )
}

export function sortPlaces(places: Place[], sort: SortId): Place[] {
  const arr = [...places]
  const byDist = (a: Place, b: Place) => a.distanceM - b.distanceM
  switch (sort) {
    case 'mesafe':
      return arr.sort(byDist)
    case 'puan':
      // Puani olmayanlar sona; esit puanda cok yorumlu once
      return arr.sort(
        (a, b) =>
          (b.rating ?? -1) - (a.rating ?? -1) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0) || byDist(a, b)
      )
    case 'hype':
      return arr.sort((a, b) => b.hype - a.hype || byDist(a, b))
    case 'ad':
      return arr.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    case 'cesit':
      return arr.sort((a, b) => a.subtype.localeCompare(b.subtype, 'tr') || byDist(a, b))
  }
}

// Bir kategorideki turlerin sayimi (alt filtre cipleri icin), cok olandan aza.
export function subtypeCounts(places: Place[]): [string, number][] {
  const m = new Map<string, number>()
  for (const p of places) m.set(p.subtype, (m.get(p.subtype) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
}
