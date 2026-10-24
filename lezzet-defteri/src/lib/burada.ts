// SU AN BURADAYIM: telefonun konumuna gore etraftaki yeme-icme mekanlari (yapay zeka yok).
// Google Haritalar anahtari varsa oradan (puanli), yoksa OpenStreetMap'ten (ucretsiz) bulunur.
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { googleYakindakiler, placesAnahtari } from './places'
import { haritaKoordinati, konumdanAdres, mesafeKm, type Konum } from './mekan'

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

// Telefonda CapacitorHttp (WebView kisitlari yok), tarayicida fetch; yonlendirme sonrasi adres de doner
async function getir(url: string): Promise<{ metin: string; son: string }> {
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({ url, responseType: 'text', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', 'Accept-Language': 'tr-TR,tr;q=0.9' } })
    if (r.status >= 400) throw new Error(String(r.status))
    return { metin: typeof r.data === 'string' ? r.data : JSON.stringify(r.data), son: r.url || url }
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return { metin: await r.text(), son: r.url || url }
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

async function osmYakindakiler(k: Konum, yaricap: number): Promise<YakinYer[]> {
  const q = `[out:json][timeout:15];(nwr(around:${yaricap},${k.lat},${k.lon})["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court)$"];nwr(around:${yaricap},${k.lat},${k.lon})["shop"~"^(bakery|pastry|confectionery)$"];);out center tags 30;`
  let ham = ''
  for (const kok of OVERPASS) {
    try {
      ham = (await getir(`${kok}?data=${encodeURIComponent(q)}`)).metin
      if (ham.trim().startsWith('{')) break
    } catch {
      /* sonraki sunucu */
    }
  }
  if (!ham.trim().startsWith('{')) throw new Error('Harita servisine ulaşılamadı. İnterneti kontrol et ya da adını / Google Haritalar linkini yaz.')
  const j = JSON.parse(ham) as { elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] }
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
    // GPS sapabilir: az sonuc varsa cember buyutulur
    if (dis.length < 3) dis = placesAnahtari() ? [...dis, ...(await googleYakindakiler(k, 400)).map((g) => ({ ad: g.ad, tur: g.tur, adres: g.adres, lat: g.lat, lon: g.lon, km: mesafeKm(k, g), googleId: g.id, puan: g.puan, yorumSayisi: g.yorumSayisi, haritaUrl: g.haritaUrl }))] : await osmYakindakiler(k, 400)
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

// Google Haritalar paylasim linkinden (maps.app.goo.gl…) mekan adi ve yeri; yapay zeka yok
export async function haritaLinkindenYer(link: string): Promise<YakinYer | undefined> {
  const { metin, son } = await getir(link)
  const birlesik = `${son}\n${metin}`
  const k = haritaKoordinati(birlesik)
  const ad =
    decodeURIComponent(son.match(/\/place\/([^/@?]+)/)?.[1] ?? '').replace(/\+/g, ' ') ||
    (metin.match(/<meta[^>]+(?:property|itemprop)="(?:og:title|name)"[^>]+content="([^"]+)"/i)?.[1] ?? '').split(/\s*[·|]\s*/)[0]
  if (!ad || /^google (maps|haritalar)$/i.test(ad)) return undefined
  return { ad: ad.trim(), tur: '', adres: '', lat: k?.lat ?? 0, lon: k?.lon ?? 0, km: 0, haritaUrl: link }
}
