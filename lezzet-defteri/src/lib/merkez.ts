// YAKININDA icin tek konum kaynagi (durum seridi sayisi, Mekanlarim "Yakininda" listesi, uzakliklar).
// Oncelik: 1) o anki GPS, 2) kullanicinin yazdigi semt, 3) son GPS konumu (yalnizca GPS gecici alinamadiysa, en fazla 6 saat).
// Sehir adi, profil sehri, mekanlardan cikarilan semt merkezi ASLA merkez olmaz. Konum izni yoksa ve semt yazilmadiysa "kapali".
// Son konumdan 100 m'den az hareket edildiyse ayni konum kullanilir; daha fazlaysa yenilenir.
import { useSyncExternalStore } from 'react'
import { konumReddedildi, konumReddiniKaydet, mesafeKm, telefonKonumu, type Konum } from './mekan'

const KEY_SON = 'lz-son-konum' // son GPS konumu {lat, lon, zaman}
const KEY_SEMT = 'lz-semt-konum' // kullanicinin yazdigi semt {lat, lon, ad}
const KEY_AD = 'lz-konum-adlari' // ters kodlama onbellegi
const AYNI_YER_M = 100
const SON_SAAT = 6

export type MerkezKaynak = 'gps' | 'semt' | 'son'
export interface Merkez {
  durum: 'bekliyor' | 'aliniyor' | 'tamam' | 'kapali'
  konum: Konum | null
  kaynak: MerkezKaynak | null
  ad: string // "Serdivan, Sakarya" (koordinattan bulunur) ya da yazilan semt
  hata: string
}

function oku<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') as T | null
  } catch {
    return null
  }
}
function yaz(k: string, v: unknown): void {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* yok */
  }
}

let durum: Merkez = { durum: 'bekliyor', konum: null, kaynak: null, ad: '', hata: '' }
const dinleyenler = new Set<() => void>()
function ayarla(d: Partial<Merkez>): void {
  durum = { ...durum, ...d }
  dinleyenler.forEach((f) => f())
}
export function merkez(): Merkez {
  return durum
}
export function useMerkez(): Merkez {
  return useSyncExternalStore(
    (f) => {
      dinleyenler.add(f)
      return () => dinleyenler.delete(f)
    },
    () => durum
  )
}

// Koordinattan ilce ve il adi (dogru sehir yazilsin diye konumun kendisinden bulunur)
export async function konumAdi(k: Konum): Promise<string> {
  const anahtar = `${k.lat.toFixed(3)},${k.lon.toFixed(3)}`
  const onbellek = oku<Record<string, string>>(KEY_AD) ?? {}
  if (onbellek[anahtar]) return onbellek[anahtar]
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=tr&lat=${k.lat}&lon=${k.lon}`, {
      headers: { Accept: 'application/json' }
    })
    if (!r.ok) return ''
    const j = (await r.json()) as { address?: Record<string, string> }
    const a = j.address ?? {}
    const ilce = a.town || a.county || a.city_district || a.district || a.suburb || a.village || ''
    const il = a.province || a.state || a.city || ''
    const ad = [ilce, il].filter((x, i, l) => x && l.indexOf(x) === i).join(', ')
    if (ad) {
      const yeni = { ...onbellek, [anahtar]: ad }
      const anahtarlar = Object.keys(yeni)
      if (anahtarlar.length > 40) delete yeni[anahtarlar[0]]
      yaz(KEY_AD, yeni)
    }
    return ad
  } catch {
    return ''
  }
}

function adiDoldur(k: Konum): void {
  void konumAdi(k).then((ad) => {
    if (ad && durum.konum && durum.konum.lat === k.lat && durum.konum.lon === k.lon && durum.kaynak !== 'semt') ayarla({ ad })
  })
}

let suren: Promise<Merkez> | null = null
let semtOturum = false
// Konumu al (ayni anda tek istek). zorla: 100 m kuralina bakmadan yeni GPS iste
export function merkezAl(zorla = false): Promise<Merkez> {
  if (suren) return suren
  suren = (async () => {
    // Bu oturumda semt elle yazildiysa kendiliginden GPS'e donulmez ("Konumumu bul" ile doner)
    if (!zorla && semtOturum && durum.kaynak === 'semt') return durum
    semtOturum = false
    if (durum.durum !== 'tamam') ayarla({ durum: 'aliniyor', hata: '' })
    const son = oku<Konum & { zaman: number }>(KEY_SON)
    const semt = oku<Konum & { ad: string }>(KEY_SEMT)
    try {
      // 1) O anki GPS (izin daha once reddedildiyse kendiliginden sorulmaz; "Konumumu bul" ile sorulur)
      if (!zorla && konumReddedildi()) throw new Error('Konum izni verilmedi.')
      const k = await telefonKonumu(zorla ? 15000 : 10000)
      let kullan: Konum = { lat: k.lat, lon: k.lon }
      if (!zorla && son && mesafeKm(son, k) * 1000 < AYNI_YER_M) kullan = { lat: son.lat, lon: son.lon }
      else yaz(KEY_SON, { ...kullan, zaman: Date.now() })
      const ayni = durum.konum && durum.kaynak === 'gps' && mesafeKm(durum.konum, kullan) * 1000 < AYNI_YER_M
      ayarla({ durum: 'tamam', konum: ayni ? durum.konum : kullan, kaynak: 'gps', ad: ayni ? durum.ad : '', hata: '' })
      if (!ayni || !durum.ad) adiDoldur(durum.konum!)
    } catch (e) {
      const hata = (e as Error).message
      const izinYok = /izi?n/i.test(hata) // "Konum izni verilmedi."
      if (izinYok && zorla) konumReddiniKaydet()
      if (semt) {
        // 2) Kullanicinin yazdigi semt
        ayarla({ durum: 'tamam', konum: { lat: semt.lat, lon: semt.lon }, kaynak: 'semt', ad: semt.ad, hata })
      } else if (!izinYok && son && Date.now() - son.zaman < SON_SAAT * 3600 * 1000) {
        // 3) GPS gecici alinamadi: son GPS konumu
        const k = { lat: son.lat, lon: son.lon }
        ayarla({ durum: 'tamam', konum: k, kaynak: 'son', ad: '', hata })
        adiDoldur(k)
      } else {
        // Uydurma yok: konum kapali
        ayarla({ durum: 'kapali', konum: null, kaynak: null, ad: '', hata })
      }
    }
    return durum
  })().finally(() => {
    suren = null
  })
  return suren
}

// Kullanici semt yazdi ve bulundu
export function semtMerkezi(k: Konum, ad: string): void {
  const s = { lat: k.lat, lon: k.lon, ad: ad.trim() }
  yaz(KEY_SEMT, s)
  semtOturum = true
  ayarla({ durum: 'tamam', konum: { lat: s.lat, lon: s.lon }, kaynak: 'semt', ad: s.ad, hata: '' })
}

// Bu konuma r km icindeki mekanlar (yalnizca koordinati olanlar), yakindan uzaga
export function yaricapIcinde<T extends { lat?: number; lon?: number }>(liste: T[], k: Konum | null, km: number): { m: T; km: number }[] {
  if (!k) return []
  return liste
    .filter((m) => m.lat !== undefined && m.lon !== undefined)
    .map((m) => ({ m, km: mesafeKm(k, { lat: m.lat!, lon: m.lon! }) }))
    .filter((x) => x.km <= km)
    .sort((a, b) => a.km - b.km)
}
