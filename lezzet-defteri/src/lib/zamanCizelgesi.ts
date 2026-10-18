// GOOGLE ZAMAN CIZELGESI AKTARMA: telefondan disa aktarilan Timeline dosyasindaki ziyaretlerden
// yeme-icme yerleri bulunur (OpenStreetMap ile; yapay zeka kullanilmaz, kredi harcanmaz).
export interface Ziyaret {
  anahtar: string // placeId ya da yuvarlanmis koordinat
  lat: number
  lon: number
  tarih: string // YYYY-AA-GG
  ad?: string // eski bicimli dosyalarda Google'in verdigi ad
  adres?: string
}
export interface Aday {
  anahtar: string
  lat: number
  lon: number
  ad: string
  tur: string
  ilce: string
  sehir: string
  adres: string
  tarihler: string[] // yeniden eskiye
}

const EV_IS = /HOME|WORK|INFERRED_HOME|INFERRED_WORK|SEARCHED_ADDRESS/i
const EN_AZ_DK = 15 // bundan kisa duraklar (gecip giden) sayilmaz

function koordinat(s: unknown): { lat: number; lon: number } | undefined {
  if (typeof s !== 'string') return undefined
  const m = s.replace('geo:', '').match(/(-?\d+(?:\.\d+)?)°?\s*,\s*(-?\d+(?:\.\d+)?)/)
  return m ? { lat: Number(m[1]), lon: Number(m[2]) } : undefined
}
const gun = (t: unknown) => (typeof t === 'string' ? t.slice(0, 10) : typeof t === 'number' ? new Date(t).toISOString().slice(0, 10) : '')
const sure = (a: unknown, b: unknown) => (Date.parse(String(b)) - Date.parse(String(a))) / 60000

// Desteklenen bicimler: telefondan disa aktarim (semanticSegments), iPhone dizisi ve eski Takeout (timelineObjects)
export function ziyaretleriOku(metin: string): Ziyaret[] {
  const j = JSON.parse(metin) as unknown
  const sonuc: Ziyaret[] = []
  const segmentler = Array.isArray(j) ? j : ((j as { semanticSegments?: unknown[] }).semanticSegments ?? [])
  for (const s of segmentler as Record<string, unknown>[]) {
    const v = s.visit as { topCandidate?: Record<string, unknown> } | undefined
    const c = v?.topCandidate
    if (!c) continue
    const tip = String(c.semanticType ?? c.semanticTypeOverride ?? '')
    if (EV_IS.test(tip)) continue
    const yer = (c.placeLocation as { latLng?: string } | string | undefined) ?? undefined
    const k = koordinat(typeof yer === 'string' ? yer : yer?.latLng)
    if (!k) continue
    if (s.endTime && s.startTime && sure(s.startTime, s.endTime) < EN_AZ_DK) continue
    sonuc.push({ anahtar: String(c.placeID ?? c.placeId ?? `${k.lat.toFixed(4)},${k.lon.toFixed(4)}`), ...k, tarih: gun(s.startTime) })
  }
  const eski = (j as { timelineObjects?: Record<string, unknown>[] }).timelineObjects ?? []
  for (const o of eski) {
    const pv = o.placeVisit as
      | { location?: { latitudeE7?: number; longitudeE7?: number; placeId?: string; name?: string; address?: string; semanticType?: string }; duration?: { startTimestamp?: string; endTimestamp?: string } }
      | undefined
    const l = pv?.location
    if (!l?.latitudeE7 || !l.longitudeE7) continue
    if (EV_IS.test(l.semanticType ?? '')) continue
    const d = pv?.duration
    if (d?.startTimestamp && d.endTimestamp && sure(d.startTimestamp, d.endTimestamp) < EN_AZ_DK) continue
    const lat = l.latitudeE7 / 1e7
    const lon = l.longitudeE7 / 1e7
    sonuc.push({ anahtar: l.placeId ?? `${lat.toFixed(4)},${lon.toFixed(4)}`, lat, lon, tarih: gun(d?.startTimestamp), ad: l.name, adres: l.address })
  }
  return sonuc.filter((z) => z.tarih)
}

// Ayni yerin ziyaretleri birlestirilir
export function yerlereGrupla(z: Ziyaret[]): (Ziyaret & { tarihler: string[] })[] {
  const m = new Map<string, Ziyaret & { tarihler: string[] }>()
  for (const x of z) {
    const v = m.get(x.anahtar)
    if (v) {
      if (!v.tarihler.includes(x.tarih)) v.tarihler.push(x.tarih)
      if (!v.ad && x.ad) v.ad = x.ad
    } else m.set(x.anahtar, { ...x, tarihler: [x.tarih] })
  }
  return [...m.values()].map((v) => ({ ...v, tarihler: v.tarihler.sort().reverse() }))
}

const YEME = new Set(['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream', 'food_court', 'biergarten'])
const DUKKAN = new Set(['bakery', 'pastry', 'confectionery', 'coffee', 'tea', 'deli'])
const TUR_AD: Record<string, string> = {
  restaurant: 'Restoran',
  cafe: 'Kafe',
  fast_food: 'Fast food',
  bar: 'Bar',
  pub: 'Pub',
  ice_cream: 'Dondurmacı',
  food_court: 'Yemek alanı',
  biergarten: 'Bahçe',
  bakery: 'Fırın',
  pastry: 'Pastane',
  confectionery: 'Tatlıcı',
  coffee: 'Kahveci',
  tea: 'Çaycı',
  deli: 'Şarküteri'
}
const KEY_ONBELLEK = 'lz-gz-yer' // anahtar -> OpenStreetMap sonucu (tekrar sorulmasin)

type OsmSonuc = { yeme: boolean; ad: string; tur: string; ilce: string; sehir: string; adres: string }
function onbellek(): Record<string, OsmSonuc> {
  try {
    return JSON.parse(localStorage.getItem(KEY_ONBELLEK) || '{}') as Record<string, OsmSonuc>
  } catch {
    return {}
  }
}

// Koordinattaki yer yeme-icme mekani mi? (OpenStreetMap; saniyede 1 istek kurali)
export async function yerBul(y: { anahtar: string; lat: number; lon: number; ad?: string }): Promise<OsmSonuc> {
  const o = onbellek()
  if (o[y.anahtar]) return o[y.anahtar]
  await new Promise((r) => setTimeout(r, 1100))
  let s: OsmSonuc = { yeme: false, ad: y.ad ?? '', tur: '', ilce: '', sehir: '', adres: '' }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&namedetails=1&accept-language=tr&lat=${y.lat}&lon=${y.lon}`, {
      headers: { Accept: 'application/json' }
    })
    if (r.ok) {
      const j = (await r.json()) as { category?: string; type?: string; name?: string; address?: Record<string, string>; display_name?: string }
      const a = j.address ?? {}
      const yeme = (j.category === 'amenity' && YEME.has(j.type ?? '')) || (j.category === 'shop' && DUKKAN.has(j.type ?? ''))
      s = {
        yeme,
        ad: y.ad || j.name || '',
        tur: TUR_AD[j.type ?? ''] ?? '',
        ilce: a.town || a.city_district || a.district || a.county || a.suburb || '',
        sehir: a.province || a.city || a.state || '',
        adres: [a.road, a.house_number, a.neighbourhood || a.suburb].filter(Boolean).join(' ')
      }
    }
  } catch {
    return s // baglanti yok: onbellege yazilmaz, sonra tekrar denenir
  }
  try {
    localStorage.setItem(KEY_ONBELLEK, JSON.stringify({ ...onbellek(), [y.anahtar]: s }))
  } catch {
    /* yok */
  }
  return s
}
