// CEVRE: Harita ve "Su an buradayim" icin hizli konum ve cevre mekanlari.
//  - Konum: son konumdan 100 m'den az hareket edildiyse ayni konum kullanilir (onbellek anahtari degismez)
//  - Cevre listesi 24 saat onbellekte (telefonda, yedege girmez)
//  - Google Places 4 sn'de cevap vermezse OpenStreetMap; ikisi de olmazsa hata (kayitli mekanlar ekranda kalir)
import { googleYakindakiler, placesAnahtari } from './places'
import { mesafeKm, telefonKonumu, type Konum } from './mekan'
import { osmYakindakiler, type YakinYer } from './burada'

const KEY_KONUM = 'lz-son-konum'
const KEY_CEVRE = 'lz-cevre-onbellek'
const AYNI_YER_M = 100
const ONBELLEK_SAAT = 24
const GOOGLE_SN = 4
export const YARICAPLAR = [1000, 3000, 5000, 10000]

function oku<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') as T | null
  } catch {
    return null
  }
}
function yaz(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* dolu ya da yok */
  }
}

// Kayitli son konum (harita hemen buraya acilir)
export function sonKonum(): (Konum & { zaman: number }) | null {
  return oku<Konum & { zaman: number }>(KEY_KONUM)
}

// Konum: telefon son 5 dakikadaki konumunu hizla verir; 100 m'den az degistiyse eski konum korunur.
// Konum alinamazsa son 6 saatteki konum kullanilir.
export async function akilliKonum(zamanAsimi = 8000): Promise<{ konum: Konum; eski: boolean }> {
  const son = sonKonum()
  try {
    const k = await telefonKonumu(zamanAsimi)
    if (son && mesafeKm(son, k) * 1000 < AYNI_YER_M) return { konum: { lat: son.lat, lon: son.lon }, eski: false }
    yaz(KEY_KONUM, { ...k, zaman: Date.now() })
    return { konum: k, eski: false }
  } catch (e) {
    if (son && Date.now() - son.zaman < 6 * 3600 * 1000) return { konum: { lat: son.lat, lon: son.lon }, eski: true }
    throw e
  }
}

interface Kayit {
  zaman: number
  kaynak: 'google' | 'osm'
  yerler: YakinYer[]
  merkez: Konum
}
type Onbellek = Record<string, Kayit>
const anahtar = (k: Konum, r: number) => `${k.lat.toFixed(3)}|${k.lon.toFixed(3)}|${r}`

// Onbellekte ayni yaricapla 100 m icinde aranmis kayit
function onbellektenBul(k: Konum, r: number): Kayit | null {
  const o = oku<Onbellek>(KEY_CEVRE) ?? {}
  const simdi = Date.now()
  const uygun = Object.entries(o)
    .filter(([key, v]) => key.endsWith(`|${r}`) && simdi - v.zaman <= ONBELLEK_SAAT * 3600 * 1000 && mesafeKm(v.merkez, k) * 1000 < AYNI_YER_M)
    .sort((a, b) => b[1].zaman - a[1].zaman)
  return uygun[0]?.[1] ?? null
}
function onbellegeYaz(k: Konum, r: number, v: Kayit): void {
  const o = oku<Onbellek>(KEY_CEVRE) ?? {}
  o[anahtar(k, r)] = v
  // En yeni 12 arama kalir
  const l = Object.entries(o).sort((a, b) => b[1].zaman - a[1].zaman).slice(0, 12)
  yaz(KEY_CEVRE, Object.fromEntries(l))
}

export interface CevreSonuc {
  yerler: YakinYer[]
  kaynak: 'google' | 'osm'
  zaman: number // listenin alindigi an
  onbellekten: boolean
}

// Cevredeki mekanlar (en fazla 20, en yakindan). yenile: onbellegi atla
export async function cevreGetir(k: Konum, yaricap: number, yenile = false): Promise<CevreSonuc> {
  if (!yenile) {
    const v = onbellektenBul(k, yaricap)
    if (v) return { yerler: v.yerler.map((y) => ({ ...y, km: mesafeKm(k, y) })), kaynak: v.kaynak, zaman: v.zaman, onbellekten: true }
  }
  let yerler: YakinYer[] | null = null
  let kaynak: 'google' | 'osm' = 'osm'
  if (placesAnahtari()) {
    const iptal = new AbortController()
    const t = setTimeout(() => iptal.abort(), GOOGLE_SN * 1000)
    try {
      yerler = (await googleYakindakiler(k, yaricap, 20, iptal.signal)).map((g) => ({
        ad: g.ad,
        tur: g.tur,
        adres: g.adres,
        lat: g.lat,
        lon: g.lon,
        km: mesafeKm(k, g),
        googleId: g.id,
        puan: g.puan,
        yorumSayisi: g.yorumSayisi,
        haritaUrl: g.haritaUrl,
        acik: g.acik
      }))
      kaynak = 'google'
    } catch {
      yerler = null // Google takildi ya da hata: OpenStreetMap
    } finally {
      clearTimeout(t)
    }
  }
  // OpenStreetMap: sunucu basina 5 sn, toplamda en fazla 10 sn
  if (!yerler)
    yerler = await Promise.race([
      osmYakindakiler(k, yaricap, 40, 5000),
      new Promise<never>((_, red) => setTimeout(() => red(new Error('Harita servisine ulaşılamadı.')), 10000))
    ])
  yerler = yerler.sort((a, b) => a.km - b.km).slice(0, 20)
  const v: Kayit = { zaman: Date.now(), kaynak, yerler, merkez: k }
  onbellegeYaz(k, yaricap, v)
  return { yerler, kaynak, zaman: v.zaman, onbellekten: false }
}

export function onceYaz(zaman: number): string {
  const dk = Math.round((Date.now() - zaman) / 60000)
  if (dk < 1) return 'az önce'
  if (dk < 60) return `${dk} dk önce`
  const sa = Math.round(dk / 60)
  return `${sa} saat önce`
}

// "850 m · 10 dk yürüme" (dakikada ~85 m)
export function yurumeYaz(km: number): string {
  const m = Math.round(km * 1000)
  const mesafe = m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
  const dk = Math.max(1, Math.round(m / 85))
  return dk <= 60 ? `${mesafe} · ${dk} dk yürüme` : mesafe
}
