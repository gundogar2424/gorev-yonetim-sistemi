// MEKANLAR: internette gorulen yeme-icme yerleri kaydedilir; yeri (enlem/boylam)
// paylasimda olmasa da arastirilarak bulunur. Kullanici bir bolgedeyken
// (telefon konumu ya da yazdigi semt) yakindaki kayitli mekanlar onerilir.
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { aiMekanAyikla, aiMekanPuan, apiAnahtari, puanTemizle, type VideoParcalari } from './ai'
import { mekanIcinTopla } from './pipeline'
import { googleMekanAra, googleMekanGetir, placesAnahtari, type GoogleMekan } from './places'
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

const KEY_RED = 'lz-konum-red'
export function konumReddedildi(): boolean {
  try {
    return localStorage.getItem(KEY_RED) === '1'
  } catch {
    return false
  }
}
export function konumReddiniKaydet(): void {
  try {
    localStorage.setItem(KEY_RED, '1')
  } catch {
    /* yok */
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
          localStorage.removeItem(KEY_RED)
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
export async function mekanLinktenEkle(
  girdi: string,
  ilerleme: (m: string) => void = () => {},
  hazir?: { parca?: VideoParcalari; kapak?: string }
): Promise<{ id: number; yeni: boolean }> {
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
  let video: VideoParcalari | undefined
  if (url) {
    try {
      // Tarif denemesinde toplanan video parcalari varsa yeniden indirilmez
      const t = hazir?.parca ? { s: await linktenTarif(url), parca: hazir.parca, kapak: hazir.kapak ?? '' } : await mekanIcinTopla(url, ilerleme)
      const s = t.s
      video = t.parca
      if (t.kapak) foto = t.kapak
      baslik = s.draft.title
      metin = [s.draft.title, s.draft.author && `Paylaşan: ${s.draft.author}`, s.hamMetin, girdi].filter(Boolean).join('\n\n')
      if (!koord) koord = haritaKoordinati(s.html)
      if (/^https:\/\//i.test(s.draft.photo)) foto = (await uzaktanFotoIndir(s.draft.photo).catch(() => '')) || foto
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
  const b = await aiMekanAyikla(metin, foto, video)
  if (!b.mekan_mi || !b.ad) throw new Error('Bu paylaşımda tarif de mekan da bulunamadı.')
  const ayni = await ayniMekan({ ad: b.ad, sehir: b.sehir })
  if (ayni) return { id: ayni.id!, yeni: false }
  ilerleme('Mekanın haritadaki yeri bulunuyor…')
  const yer = koord ? { k: koord, kaynak: 'harita' as const } : await yerBul(b, { lat: b.enlem || 0, lon: b.boylam || 0 })
  // Google Haritalar anahtari varsa mekanin kesin kaydi oradan alinir
  let g: GoogleMekan | undefined
  if (placesAnahtari()) {
    ilerleme('Google Haritalar’da aranıyor…')
    try {
      g = await googleMekanAra([b.ad, b.adres || b.ilce, b.sehir].filter(Boolean).join(' '), koord ?? (b.enlem || b.boylam ? { lat: b.enlem, lon: b.boylam } : undefined))
    } catch {
      /* Google bulamazsa / anahtar sorunu: yapay zeka sonucuyla devam */
    }
    if (g) {
      const var_ = (await lzDb.mekanlar.toArray()).find((x) => x.googleId === g!.id)
      if (var_) return { id: var_.id!, yeni: false }
    }
  }
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
    createdAt: Date.now(),
    puan: puanTemizle(b.google_puan) || undefined,
    yorumSayisi: b.yorum_sayisi > 0 ? Math.round(b.yorum_sayisi) : undefined,
    yorumOzeti: String(b.yorum_ozeti ?? '').trim() || undefined,
    puanZamani: puanTemizle(b.google_puan) ? Date.now() : undefined
  }
  if (g) googleIleBirlestir(kayit, g)
  return { id: await lzDb.mekanlar.add(kayit), yeni: true }
}

// Elle (ad + semt) eklenen mekan da arastirilir
export async function mekanAdlaEkle(ad: string, bolge: string): Promise<{ id: number; yeni: boolean }> {
  return mekanLinktenEkle(`${ad}${bolge ? ` — ${bolge}` : ''}`)
}

// Google Haritalar kaydindaki kesin bilgiler mekanin uzerine yazilir
function googleIleBirlestir(k: Partial<LzMekan>, g: GoogleMekan): void {
  k.googleId = g.id
  if (g.ad) k.ad = g.ad
  if (g.adres) k.adres = g.adres
  if (g.lat || g.lon) {
    k.lat = g.lat
    k.lon = g.lon
    k.konumKaynak = 'google'
  }
  if (g.puan) {
    k.puan = g.puan
    k.yorumSayisi = g.yorumSayisi || undefined
    k.puanZamani = Date.now()
  }
  if (g.haritaUrl) k.haritaUrl = g.haritaUrl
  if (!k.tur && g.tur) k.tur = g.tur
  if (g.fiyat && k.etiketler && !k.etiketler.some((e) => /^₺+$/.test(e))) k.etiketler = [...k.etiketler, g.fiyat.length > 3 ? '₺₺₺' : g.fiyat]
}

// Adres degisince/duzeltilince yeri yeniden bul
export async function mekanYeriniBul(m: LzMekan): Promise<boolean> {
  if (placesAnahtari()) {
    try {
      const g = await googleMekanAra([m.ad, m.adres || m.ilce, m.sehir].filter(Boolean).join(' '))
      if (g) {
        const k: Partial<LzMekan> = { etiketler: m.etiketler, tur: m.tur }
        googleIleBirlestir(k, g)
        await lzDb.mekanlar.update(m.id!, k)
        return true
      }
    } catch {
      /* yapay zeka / OpenStreetMap ile devam */
    }
  }
  const yer = await yerBul(m)
  if (!yer.k) return false
  await lzDb.mekanlar.update(m.id!, { lat: yer.k.lat, lon: yer.k.lon, konumKaynak: yer.kaynak })
  return true
}

// Google Haritalar'da mekanin kartini acar (ad + adres ile arama en dogru sonucu verir)
export function haritadaAcLinki(m: LzMekan): string {
  if (m.haritaUrl) return m.haritaUrl
  const q = m.ad ? [m.ad, m.adres || m.ilce, m.sehir].filter(Boolean).join(' ') : `${m.lat},${m.lon}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function yolTarifiLinki(m: LzMekan): string {
  if (m.googleId) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.ad)}&destination_place_id=${encodeURIComponent(m.googleId)}`
  const hedef = m.lat !== undefined && m.lon !== undefined ? `${m.lat},${m.lon}` : [m.ad, m.adres, m.ilce, m.sehir].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hedef)}`
}

// Google puani ve yorum ozetini yeniden arastirir
export async function puaniGuncelle(m: LzMekan): Promise<boolean> {
  // Google Haritalar anahtari varsa puan dogrudan Google'dan
  if (placesAnahtari()) {
    const g = m.googleId ? await googleMekanGetir(m.googleId) : await googleMekanAra([m.ad, m.adres || m.ilce, m.sehir].filter(Boolean).join(' '))
    if (g) {
      const k: Partial<LzMekan> = { etiketler: m.etiketler, tur: m.tur, puanZamani: Date.now() }
      googleIleBirlestir(k, g)
      await lzDb.mekanlar.update(m.id!, k)
      return !!g.puan
    }
  }
  const p = await aiMekanPuan(m)
  await lzDb.mekanlar.update(m.id!, {
    puan: p.puan || undefined,
    yorumSayisi: p.yorumSayisi || undefined,
    yorumOzeti: p.yorumOzeti || undefined,
    puanZamani: Date.now()
  })
  return !!p.puan
}

// Google Haritalar'da mekanin yorumlarini acar
export function yorumlarLinki(m: LzMekan): string {
  if (m.haritaUrl) return m.haritaUrl
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([m.ad, m.ilce || m.adres, m.sehir].filter(Boolean).join(' '))}`
}

export function puanYaz(m: Pick<LzMekan, 'puan' | 'yorumSayisi'>): string {
  if (!m.puan) return ''
  const y = m.yorumSayisi ? ` (${m.yorumSayisi.toLocaleString('tr')})` : ''
  return `⭐ ${m.puan.toFixed(1).replace('.', ',')}${y}`
}
