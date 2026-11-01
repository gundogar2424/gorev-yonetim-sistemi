// SU AN BURADAYIM: telefonun konumuna gore etraftaki yeme-icme mekanlari (yapay zeka yok).
// Google Haritalar anahtari varsa oradan (puanli), yoksa OpenStreetMap'ten (ucretsiz) bulunur.
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { googleMekanAra, googleYakindakiler, placesAnahtari } from './places'
import { adrestenKonum, haritaKoordinati, konumdanAdres, mesafeKm, type Konum } from './mekan'

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
const UA_TEL = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
async function getir(url: string, ua = UA_TEL): Promise<{ metin: string; son: string }> {
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({ url, responseType: 'text', headers: { 'User-Agent': ua, 'Accept-Language': 'tr-TR,tr;q=0.9' } })
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
export async function yeriKaydet(y: YakinYer, k?: Konum): Promise<number> {
  if (y.kayitliId) return y.kayitliId
  const lat = y.lat || k?.lat
  const lon = y.lon || k?.lon
  const bolge = lat !== undefined && lon !== undefined ? await konumdanAdres({ lat, lon }).catch(() => '') : ''
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
    lat,
    lon,
    konumKaynak: lat === undefined ? '' : y.googleId ? 'google' : 'harita',
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

// Google Haritalar paylasim linkinden (maps.app.goo.gl…) mekan adi ve yeri; yapay zeka yok.
// Kisa link telefon kimligine ara sayfa (uygulamaya yonlendirme) dondurebilir; bu yuzden birkac kimlikle
// denenir ve sayfanin icindeki asil harita adresleri de taranir. Bicimler: /maps/place/AD/@enlem,boylam ·
// ?q=AD,+adres · ?cid=… (ad sayfa basligindan).
const UA_MASA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const UA_BOT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
function coz(x: string): string {
  try {
    return decodeURIComponent(x.replace(/\+/g, ' '))
  } catch {
    return x.replace(/\+/g, ' ')
  }
}
function kacissiz(x: string): string {
  return x.replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&')
}
function metaIcerik(html: string, ad: string): string {
  const tag = html.match(new RegExp(`<meta[^>]*(?:property|itemprop|name)=["']${ad}["'][^>]*>`, 'i'))?.[0] ?? ''
  return (tag.match(/content=["']([^"']+)["']/i)?.[1] ?? '').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
}
const GENEL = /^(google ?maps|google haritalar|haritalar|maps|google)$/i
// Harita sayfasinin icindeki konum: onizleme resmi (center= / markers=), sayfa acilis durumu, !3d!4d
function sayfaKoordinati(html: string): Konum | undefined {
  const desen = [
    /markers=(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/,
    /center=(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/
  ]
  for (const d of desen) {
    const m = html.match(d)
    if (m) return { lat: Number(m[1]), lon: Number(m[2]) }
  }
  // APP_INITIALIZATION_STATE=[[[uzaklik,boylam,enlem]…
  const a = html.match(/APP_INITIALIZATION_STATE=\[\[\[[\d.]+,(-?\d{1,3}\.\d+),(-?\d{1,2}\.\d+)\]/)
  if (a) return { lat: Number(a[2]), lon: Number(a[1]) }
  return undefined
}
// Sayfa aciklamasindan Google puani, yorum sayisi ve tur ("4,5(8) · Aile restoranı" gibi)
function sayfaBilgisi(html: string): { puan?: number; yorum?: number; tur?: string; adres?: string } {
  const t = metaIcerik(html, 'og:title')
  const d = metaIcerik(html, 'og:description') || metaIcerik(html, 'description')
  const puan = Number((d.match(/(\d[.,]\d)\s*(?:★|\(|yıldız)/)?.[1] ?? '').replace(',', '.')) || undefined
  const yorum = Number((d.match(/\((\d[\d.,]*)\)/)?.[1] ?? '').replace(/[.,]/g, '')) || undefined
  const tur = d.split(/\s*·\s*/).map((x) => x.trim()).find((x) => x && !/\d|★/.test(x) && x.length < 40)
  return { puan, yorum, tur, adres: (t.split(/\s*·\s*/)[1] ?? '').trim() || undefined }
}
function adresten(u: string): string {
  const yer = u.match(/\/place\/([^/@?]+)/)?.[1]
  if (yer) return coz(yer)
  const q = u.match(/[?&](?:q|query)=([^&]+)/)?.[1]
  if (q && !/^-?\d+\.\d+/.test(coz(q)) && !/^place_id:/i.test(coz(q))) return coz(q).split(',')[0]
  return ''
}
function sayfadan(html: string): { ad: string; adres: string } {
  const t = metaIcerik(html, 'og:title') || metaIcerik(html, 'name') || (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '')
  const [ad, adres] = t.split(/\s*·\s*/)
  return { ad: (ad ?? '').split(/\s+[|–-]\s+/)[0].trim(), adres: (adres ?? '').trim() }
}

export async function haritaLinkindenYer(link: string): Promise<YakinYer | undefined> {
  let ad = ''
  let adres = ''
  let k: Konum | undefined
  let bilgi: ReturnType<typeof sayfaBilgisi> = {}
  let bulunanAd = ''
  let bulunanAdres = ''
  const gorulen: string[] = []
  for (const ua of [UA_MASA, UA_BOT, UA_TEL]) {
    const g = await getir(link, ua).catch(() => undefined)
    if (!g) continue
    const html = kacissiz(g.metin)
    const adaylar = [g.son, ...(html.match(/https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)[^"'\s<>\\]*/gi) ?? [])]
    gorulen.push(g.son)
    k = k ?? haritaKoordinati(adaylar.join('\n')) ?? sayfaKoordinati(html)
    const b = sayfaBilgisi(html)
    bilgi = { puan: bilgi.puan ?? b.puan, yorum: bilgi.yorum ?? b.yorum, tur: bilgi.tur ?? b.tur, adres: bilgi.adres ?? b.adres }
    for (const u of adaylar) {
      ad = adresten(u)
      if (ad) break
    }
    if (!ad) ({ ad, adres } = sayfadan(html))
    // cid gibi adsiz harita adresi: o sayfanin basligindan
    if ((!ad || GENEL.test(ad)) && adaylar[1]) {
      const h2 = await getir(adaylar[1], UA_BOT).catch(() => undefined)
      if (h2) {
        ;({ ad, adres } = sayfadan(kacissiz(h2.metin)))
        k = k ?? haritaKoordinati(h2.son) ?? sayfaKoordinati(kacissiz(h2.metin))
      }
    }
    if (ad && !GENEL.test(ad)) bulunanAd = bulunanAd || ad
    if (!bulunanAd && adres) bulunanAdres = adres
    else if (adres) bulunanAdres = bulunanAdres || adres
    // Ad ve konum bulunduysa dur; konum yoksa diger kimliklerle de dene
    if (bulunanAd && k) break
  }
  ad = bulunanAd
  adres = bulunanAdres
  if (!adres && bilgi.adres) adres = bilgi.adres
  if (!ad) throw new Error(`Harita linki okunamadı${gorulen[0] ? ` (yönlendiği adres: ${gorulen[0].slice(0, 90)})` : ' (bağlantı kurulamadı)'}`)
  let yer = k
  if (!yer) {
    if (placesAnahtari()) {
      const g = await googleMekanAra(`${ad} ${adres}`).catch(() => undefined)
      if (g) return { ad: g.ad || ad, tur: g.tur, adres: g.adres, lat: g.lat, lon: g.lon, km: 0, googleId: g.id, puan: g.puan, yorumSayisi: g.yorumSayisi, haritaUrl: g.haritaUrl || link }
    }
    yer = (await adrestenKonum(`${ad} ${adres}`.trim()).catch(() => undefined)) ?? (adres ? await adrestenKonum(adres).catch(() => undefined) : undefined)
  }
  return { ad, tur: bilgi.tur ?? '', adres, lat: yer?.lat ?? 0, lon: yer?.lon ?? 0, km: 0, puan: bilgi.puan, yorumSayisi: bilgi.yorum, haritaUrl: link }
}
