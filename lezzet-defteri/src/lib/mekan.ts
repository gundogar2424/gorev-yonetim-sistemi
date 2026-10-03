// MEKANLAR: internette gorulen yeme-icme yerleri kaydedilir; yeri (enlem/boylam)
// paylasimda olmasa da arastirilarak bulunur. Kullanici bir bolgedeyken
// (telefon konumu ya da yazdigi semt) yakindaki kayitli mekanlar onerilir.
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { aiMekanAyikla, apiAnahtari } from './ai'
import { linkAyikla, linktenTarif, metinIndir, platformBul } from './importer'
import { uzaktanFotoIndir } from './image'
import { temelLink } from './kopya'

export type Konum = { lat: number; lon: number; ad?: string }

// Google Maps / Apple Maps linkindeki koordinat
export function haritaKoordinati(metin: string): Konum | undefined {
  const desen = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination|daddr|center)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i
  ]
  for (const d of desen) {
    const m = metin.match(d)
    if (m) {
      const lat = Number(m[1])
      const lon = Number(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon)) return { lat, lon }
    }
  }
  return undefined
}

export function haritaLinkiMi(url: string): boolean {
  return /(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com|yandex\.[a-z.]+\/maps|foursquare\.com|tripadvisor\.)/i.test(url)
}

// Adres/semt -> koordinat (OpenStreetMap, ucretsiz)
export async function adrestenKonum(sorgu: string): Promise<Konum | undefined> {
  const q = sorgu.trim()
  if (!q) return undefined
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=tr&q=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!r.ok) return undefined
    const j = (await r.json()) as { lat: string; lon: string; display_name: string }[]
    if (!j[0]) return undefined
    return { lat: Number(j[0].lat), lon: Number(j[0].lon), ad: j[0].display_name }
  } catch {
    return undefined
  }
}

export function mesafeKm(a: Konum, b: Konum): number {
  const R = 6371
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(b.lat - a.lat)
  const dLon = r(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function mesafeYaz(km: number): string {
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`
}

const KEY_IZIN = 'lz-konum-izin'
export function konumIzniVerildi(): boolean {
  try {
    return localStorage.getItem(KEY_IZIN) === '1'
  } catch {
    return false
  }
}

// Telefonun konumu (izin istenir). Verilmezse hata atar.
export function telefonKonumu(zamanAsimi = 12000): Promise<Konum> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Bu cihazda konum alınamıyor.'))
    navigator.geolocation.getCurrentPosition(
      (p) => {
        try {
          localStorage.setItem(KEY_IZIN, '1')
        } catch {
          /* yok */
        }
        res({ lat: p.coords.latitude, lon: p.coords.longitude })
      },
      (e) => rej(new Error(e.code === 1 ? 'Konum izni verilmedi.' : 'Konum alınamadı.')),
      { enableHighAccuracy: false, timeout: zamanAsimi, maximumAge: 5 * 60 * 1000 }
    )
  })
}

// Mekanin yerini bulur: harita linki > yapay zekanin bulup adresle dogrulanan > adres > ad + semt
async function yerBul(m: Pick<LzMekan, 'ad' | 'adres' | 'ilce' | 'sehir'>, ai?: { lat: number; lon: number }): Promise<{ k?: Konum; kaynak: LzMekan['konumKaynak'] }> {
  const bolge = [m.ilce, m.sehir].filter(Boolean).join(', ')
  if (m.adres) {
    const k = await adrestenKonum([m.adres, bolge].filter(Boolean).join(', '))
    if (k) return { k, kaynak: 'adres' }
  }
  if (ai && (ai.lat || ai.lon)) return { k: ai, kaynak: 'arama' }
  for (const q of [[m.ad, bolge].filter(Boolean).join(', '), bolge]) {
    const k = await adrestenKonum(q)
    if (k) return { k, kaynak: q === bolge ? '' : 'adres' }
  }
  return { kaynak: '' }
}

export async function ayniMekan(m: { ad: string; sehir: string; sourceUrl?: string }): Promise<LzMekan | undefined> {
  const hepsi = await lzDb.mekanlar.toArray()
  const t = m.sourceUrl ? temelLink(m.sourceUrl) : ''
  const ad = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')
  return hepsi.find(
    (x) => (t && x.sourceUrl && temelLink(x.sourceUrl) === t) || (ad(x.ad) && ad(x.ad) === ad(m.ad) && ad(x.sehir) === ad(m.sehir))
  )
}

// Paylasilan linkten (Instagram, TikTok, YouTube, Google Maps…) mekan kaydi olusturur.
// Mekan degilse hata atar. Ayni mekan varsa var olanin kimligi doner.
export async function mekanLinktenEkle(girdi: string, ilerleme: (m: string) => void = () => {}): Promise<{ id: number; yeni: boolean }> {
  if (!apiAnahtari()) throw new Error('Mekanı tanımak için Ayarlar’dan Gemini anahtarı gir.')
  const url = linkAyikla(girdi)
  if (url) {
    const var_ = await ayniMekan({ ad: '', sehir: '', sourceUrl: url })
    if (var_) return { id: var_.id!, yeni: false }
  }
  ilerleme('Mekan paylaşımı okunuyor…')
  let metin = girdi
  let foto = ''
  let baslik = ''
  let koord = url ? haritaKoordinati(url) : undefined
  if (url) {
    try {
      const s = await linktenTarif(url)
      baslik = s.draft.title
      metin = [s.draft.title, s.draft.author && `Paylaşan: ${s.draft.author}`, s.hamMetin, girdi].filter(Boolean).join('\n\n')
      if (!koord) koord = haritaKoordinati(s.html)
      if (/^https:\/\//i.test(s.draft.photo)) foto = await uzaktanFotoIndir(s.draft.photo).catch(() => '')
    } catch {
      // Harita kisa linki gibi okunamayan sayfa: yonlendirilen adresi dene
      if (haritaLinkiMi(url)) {
        const html = await metinIndir(url, 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36').catch(() => '')
        koord = koord ?? haritaKoordinati(html)
        metin = `${girdi}\n\n${html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? ''}`
      }
    }
  }
  ilerleme('Yapay zeka mekanı araştırıyor…')
  const b = await aiMekanAyikla(metin, foto)
  if (!b.mekan_mi || !b.ad) throw new Error('Bu paylaşımda tarif de mekan da bulunamadı.')
  const ayni = await ayniMekan({ ad: b.ad, sehir: b.sehir })
  if (ayni) return { id: ayni.id!, yeni: false }
  ilerleme('Mekanın haritadaki yeri bulunuyor…')
  const yer = koord ? { k: koord, kaynak: 'harita' as const } : await yerBul(b, { lat: b.enlem || 0, lon: b.boylam || 0 })
  const kayit: LzMekan = {
    ad: b.ad || baslik || 'Mekan',
    tur: b.tur,
    adres: b.adres,
    ilce: b.ilce,
    sehir: b.sehir,
    lat: yer.k?.lat,
    lon: yer.k?.lon,
    konumKaynak: yer.kaynak,
    oneriler: b.oneriler,
    fiyat: b.fiyat,
    notlar: b.notlar,
    etiketler: b.etiketler,
    foto,
    sourceUrl: url,
    platform: url ? platformBul(url) : 'manual',
    gidildi: false,
    createdAt: Date.now()
  }
  return { id: await lzDb.mekanlar.add(kayit), yeni: true }
}

// Elle (ad + semt) eklenen mekan da arastirilir
export async function mekanAdlaEkle(ad: string, bolge: string): Promise<{ id: number; yeni: boolean }> {
  return mekanLinktenEkle(`${ad}${bolge ? ` — ${bolge}` : ''}`)
}

// Adres degisince/duzeltilince yeri yeniden bul
export async function mekanYeriniBul(m: LzMekan): Promise<boolean> {
  const yer = await yerBul(m)
  if (!yer.k) return false
  await lzDb.mekanlar.update(m.id!, { lat: yer.k.lat, lon: yer.k.lon, konumKaynak: yer.kaynak })
  return true
}

// Google Haritalar'da mekanin kartini acar (ad + adres ile arama en dogru sonucu verir)
export function haritadaAcLinki(m: LzMekan): string {
  const q = m.ad ? [m.ad, m.adres || m.ilce, m.sehir].filter(Boolean).join(' ') : `${m.lat},${m.lon}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function yolTarifiLinki(m: LzMekan): string {
  const hedef = m.lat !== undefined && m.lon !== undefined ? `${m.lat},${m.lon}` : [m.ad, m.adres, m.ilce, m.sehir].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hedef)}`
}
