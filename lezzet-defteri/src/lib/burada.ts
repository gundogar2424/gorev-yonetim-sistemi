// SU AN BURADAYIM: telefonun konumuna gore etraftaki yeme-icme mekanlari (yapay zeka yok).
// Google Haritalar anahtari varsa oradan (puanli), yoksa OpenStreetMap'ten (ucretsiz) bulunur.
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { googleYakindakiler, placesAnahtari } from './places'
import { konumdanAdres, mesafeKm, type Konum } from './mekan'

export interface YakinYer {
  ad: string
  tur: string
  adres: string
  lat: number
  lon: number
  km: number
  kayitliId?: number
  googleId?: string
  puan?: number
  yorumSayisi?: number
  haritaUrl?: string
}

const TUR: Record<string, string> = {
  restaurant: 'Restoran',
  cafe: 'Kafe',
  fast_food: 'Fast food',
  bar: 'Bar',
  pub: 'Pub',
  ice_cream: 'Dondurmacı',
  bakery: 'Fırın / Pastane',
  pastry: 'Pastane',
  confectionery: 'Tatlıcı'
}

async function osmYakindakiler(k: Konum, yaricap: number): Promise<YakinYer[]> {
  const q = `[out:json][timeout:15];(nwr(around:${yaricap},${k.lat},${k.lon})["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court)$"];nwr(around:${yaricap},${k.lat},${k.lon})["shop"~"^(bakery|pastry|confectionery)$"];);out center tags 30;`
  const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
  if (!r.ok) throw new Error('Yakındaki mekanlar alınamadı (harita servisi). Biraz sonra dene ya da adını yaz.')
  const j = (await r.json()) as { elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] }
  return (j.elements ?? [])
    .filter((e) => e.tags?.name)
    .map((e) => {
      const lat = e.lat ?? e.center?.lat ?? k.lat
      const lon = e.lon ?? e.center?.lon ?? k.lon
      const t = e.tags!
      return {
        ad: t.name,
        tur: TUR[t.amenity ?? t.shop ?? ''] ?? (t.cuisine ? t.cuisine.split(';')[0] : ''),
        adres: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '),
        lat,
        lon,
        km: mesafeKm(k, { lat, lon })
      }
    })
}

// Etraftaki mekanlar: once kayitli olanlar (150 m), sonra haritadakiler; en yakindan
export async function yakindakiYerler(k: Konum): Promise<YakinYer[]> {
  const kayitli = (await lzDb.mekanlar.toArray()).filter((m) => m.lat !== undefined && m.lon !== undefined && mesafeKm(k, { lat: m.lat, lon: m.lon! }) <= 0.15)
  let dis: YakinYer[] = []
  try {
    dis = placesAnahtari()
      ? (await googleYakindakiler(k)).map((g) => ({ ad: g.ad, tur: g.tur, adres: g.adres, lat: g.lat, lon: g.lon, km: mesafeKm(k, g), googleId: g.id, puan: g.puan, yorumSayisi: g.yorumSayisi, haritaUrl: g.haritaUrl }))
      : await osmYakindakiler(k, 150)
  } catch (e) {
    if (!kayitli.length) throw e
  }
  const sade = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')
  const liste: YakinYer[] = kayitli.map((m) => ({ ad: m.ad, tur: m.tur, adres: m.adres, lat: m.lat!, lon: m.lon!, km: mesafeKm(k, { lat: m.lat!, lon: m.lon! }), kayitliId: m.id }))
  for (const d of dis) if (!liste.some((x) => sade(x.ad) === sade(d.ad))) liste.push(d)
  return liste.sort((a, b) => (a.kayitliId ? -1 : 0) - (b.kayitliId ? -1 : 0) || a.km - b.km).slice(0, 15)
}

// Secilen yeri Mekanlarim'a kaydeder (kayitliysa o); adres/semt konumdan doldurulur
export async function yeriKaydet(y: YakinYer, k: Konum): Promise<number> {
  if (y.kayitliId) return y.kayitliId
  const bolge = await konumdanAdres({ lat: y.lat, lon: y.lon }).catch(() => '')
  // "Mahalle, Ilce, Il" -> ilce ve il
  const p = bolge.split(',').map((x) => x.trim()).filter(Boolean)
  const sehir = p.length ? p[p.length - 1] : ''
  const ilce = p.length >= 2 ? p[p.length - 2] : ''
  const m: LzMekan = {
    ad: y.ad,
    tur: y.tur,
    adres: y.adres,
    ilce,
    sehir,
    lat: y.lat || k.lat,
    lon: y.lon || k.lon,
    konumKaynak: y.googleId ? 'google' : 'harita',
    oneriler: [],
    fiyat: '',
    notlar: '',
    etiketler: [],
    foto: '',
    sourceUrl: '',
    platform: 'manual',
    gidildi: false,
    createdAt: Date.now(),
    googleId: y.googleId,
    puan: y.puan || undefined,
    yorumSayisi: y.yorumSayisi || undefined,
    puanZamani: y.puan ? Date.now() : undefined,
    haritaUrl: y.haritaUrl || undefined
  }
  return lzDb.mekanlar.add(m)
}
