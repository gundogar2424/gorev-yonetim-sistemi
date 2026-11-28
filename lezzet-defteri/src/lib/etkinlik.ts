// SAKARYA'DA BU HAFTA + BILETLERIM
// Etkinlikler gunde 1 kez aranir, 24 saat saklanir. Biletler telefonda (Dexie: biletler) durur.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { lzDb } from '../db'
import type { LzBilet } from '../types'

export const ETKINLIK_TURLERI = ['Sinema', 'Tiyatro', 'Konser', 'Festival'] as const
export type EtkinlikTur = (typeof ETKINLIK_TURLERI)[number]

export interface Etkinlik {
  ad: string
  tur: EtkinlikTur
  tarih: string // YYYY-AA-GG
  saat: string // SS:DD ya da '' (bilinmiyor)
  yer: string
  fiyat: string // "250 TL", "Ücretsiz" ya da '' (bilinmiyor)
  link: string
}

const KEY = 'lz-etkinlik-hafta' // { [sehir]: { zaman, liste } } : her sehir ayri, 24 saat
const KEY_ESKI = 'lz-sakarya-hafta' // onceki surum (yalnizca Sakarya)
const KEY_SEHIR = 'lz-etkinlik-sehir'
const SAAT24 = 24 * 3600 * 1000
const iki = (n: number) => String(n).padStart(2, '0')
export const gunYaz = (d: Date) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`

export const VARSAYILAN_SEHIR = 'Sakarya'
export const ILLER = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
  'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri',
  'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
  'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop', 'Şırnak', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
]
export function etkinlikSehri(): string {
  try {
    const v = localStorage.getItem(KEY_SEHIR) ?? ''
    return ILLER.includes(v) ? v : VARSAYILAN_SEHIR
  } catch {
    return VARSAYILAN_SEHIR
  }
}
export function etkinlikSehriYaz(sehir: string): void {
  try {
    localStorage.setItem(KEY_SEHIR, sehir)
  } catch {
    /* yok */
  }
}
// "Sakarya’da", "İstanbul’da", "İzmir’de", "Sinop’ta", "Gaziantep’te"
export function bulunmaEki(sehir: string): string {
  const k = sehir.toLocaleLowerCase('tr')
  const unlu = [...k].reverse().find((h) => 'aıoueiöü'.includes(h)) ?? 'a'
  const sert = 'fstkçşhp'.includes(k.slice(-1))
  return `${sehir}’${sert ? 't' : 'd'}${'aıou'.includes(unlu) ? 'a' : 'e'}`
}
export const buHaftaBaslik = (sehir: string) => `${bulunmaEki(sehir)} Bu Hafta`

type Kayit = { zaman: number; liste: Etkinlik[] }
function tumOnbellek(): Record<string, Kayit> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Kayit>
    const temiz: Record<string, Kayit> = {}
    for (const [k, x] of Object.entries(v ?? {})) if (x && Array.isArray(x.liste) && Date.now() - x.zaman < SAAT24) temiz[k] = x
    // Onceki surumun Sakarya aramasi (24 saat dolmadiysa) yeniden aranmasin
    if (!temiz[VARSAYILAN_SEHIR]) {
      const e = JSON.parse(localStorage.getItem(KEY_ESKI) || 'null') as Kayit | null
      if (e && Array.isArray(e.liste) && Date.now() - e.zaman < SAAT24) temiz[VARSAYILAN_SEHIR] = e
    }
    return temiz
  } catch {
    return {}
  }
}
export function etkinlikOnbellek(sehir: string): Kayit | undefined {
  return tumOnbellek()[sehir]
}
export function etkinlikOnbellegeYaz(sehir: string, liste: Etkinlik[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...tumOnbellek(), [sehir]: { zaman: Date.now(), liste } }))
  } catch {
    /* yok */
  }
}

// Yalnizca onumuzdeki 7 gun (bugun dahil), bilinen 4 turden, tarihe gore sirali
export function haftaSuz(liste: Etkinlik[], simdi = new Date()): Etkinlik[] {
  const bas = gunYaz(simdi)
  const son = gunYaz(new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() + 7))
  return liste
    .filter((e) => e?.ad && /^\d{4}-\d{2}-\d{2}$/.test(e.tarih) && e.tarih >= bas && e.tarih <= son && (ETKINLIK_TURLERI as readonly string[]).includes(e.tur))
    .map((e) => ({ ...e, saat: /^\d{1,2}:\d{2}$/.test(e.saat ?? '') ? e.saat.padStart(5, '0') : '' }))
    .sort((a, b) => (a.tarih + (a.saat || '99')).localeCompare(b.tarih + (b.saat || '99')))
}

const sade = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')
export const etkinlikAnahtar = (e: { ad: string; tarih: string }) => `${sade(e.ad)}|${e.tarih}`

const GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
// "29 Kas Cmt · 20:30"
export function tarihYaz(tarih: string, saat = ''): string {
  const [y, a, g] = tarih.split('-').map(Number)
  const d = new Date(y, a - 1, g)
  return `${g} ${AYLAR[a - 1]} ${GUNLER[d.getDay()]}${saat ? ` · ${saat}` : ''}`
}

// Etkinlik ani: saat bilinmiyorsa gun sonu
export function etkinlikZamani(b: Pick<LzBilet, 'tarih' | 'saat'>): number {
  const [y, a, g] = b.tarih.split('-').map(Number)
  const [s, d] = b.saat ? b.saat.split(':').map(Number) : [23, 59]
  return new Date(y, a - 1, g, s, d).getTime()
}
export function gectiMi(b: Pick<LzBilet, 'tarih' | 'saat'>, simdi = Date.now()): boolean {
  return simdi > etkinlikZamani(b)
}
// Takvim gunu farki (bugun = 0)
export function gunKaldi(tarih: string, simdi = new Date()): number {
  const [y, a, g] = tarih.split('-').map(Number)
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime()
  return Math.round((new Date(y, a - 1, g).getTime() - bugun) / 864e5)
}
export function kalanYazi(b: Pick<LzBilet, 'tarih' | 'saat'>, simdi = new Date()): string {
  const g = gunKaldi(b.tarih, simdi)
  if (g < 0 || gectiMi(b, simdi.getTime())) return 'Geçti'
  if (g === 0) return 'Bugün'
  return `${g} gün kaldı`
}
// Kum saati: bilet alindigi gun dolu (1), etkinlik gunu bos (0); gun azaldikca azalir
export function kumOrani(b: Pick<LzBilet, 'tarih' | 'createdAt'>, simdi = new Date()): number {
  const kalan = gunKaldi(b.tarih, simdi)
  if (kalan <= 0) return 0
  const toplam = Math.max(kalan, gunKaldi(b.tarih, new Date(b.createdAt)), 1)
  return Math.max(0, Math.min(1, kalan / toplam))
}

// --- Harcama -------------------------------------------------------------
export function biletToplam(b: Pick<LzBilet, 'harcama'>): number {
  const h = b.harcama
  return h ? (h.bilet || 0) + (h.yol || 0) + (h.yemek || 0) : 0
}
export interface EtkinlikOdeme {
  tarih: string
  tutar: number
  ad: string
}
// Harcamalarim'a giren etkinlik harcamalari (bilet + yol + yemek)
export function etkinlikOdemeleri(biletler: LzBilet[]): EtkinlikOdeme[] {
  return biletler
    .map((b) => ({ tarih: b.tarih, tutar: biletToplam(b), ad: b.ad }))
    .filter((o) => o.tutar > 0)
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
}

// --- Hatirlatmalar -------------------------------------------------------
export interface Hatirlatma {
  no: number
  zaman: number
  baslik: string
  metin: string
  yol: string
}
// 7 gun kala, 3 gun kala, 1 gun kala (10:00), etkinlik gunu sabah (09:00), 2 saat once "Yola cik" (saat biliniyorsa)
export function hatirlatmalar(b: LzBilet, simdi = Date.now()): Hatirlatma[] {
  const [y, a, g] = b.tarih.split('-').map(Number)
  const gun = (once: number, saat: number) => new Date(y, a - 1, g - once, saat, 0).getTime()
  const nerede = `${tarihYaz(b.tarih, b.saat)}${b.yer ? ` · ${b.yer}` : ''}`
  const taban = 700000 + (b.id ?? 0) * 10
  const l: Hatirlatma[] = [
    { no: taban + 1, zaman: gun(7, 10), baslik: `7 gün kaldı: ${b.ad}`, metin: nerede, yol: '/sakarya-bu-hafta?sekme=bilet' },
    { no: taban + 2, zaman: gun(3, 10), baslik: `3 gün kaldı: ${b.ad}`, metin: nerede, yol: '/sakarya-bu-hafta?sekme=bilet' },
    { no: taban + 3, zaman: gun(1, 10), baslik: `Yarın: ${b.ad}`, metin: nerede, yol: '/sakarya-bu-hafta?sekme=bilet' },
    { no: taban + 4, zaman: gun(0, 9), baslik: `Bugün: ${b.ad}`, metin: nerede, yol: '/sakarya-bu-hafta?sekme=bilet' }
  ]
  if (b.saat) l.push({ no: taban + 5, zaman: etkinlikZamani(b) - 2 * 3600 * 1000, baslik: `Yola çık: ${b.ad}`, metin: `2 saat kaldı · ${nerede}`, yol: '/sakarya-bu-hafta?sekme=bilet' })
  return l.filter((h) => h.zaman > simdi)
}

type Yerel = { kur(o: { liste: Hatirlatma[] }): Promise<void> }
const yerel = registerPlugin<Yerel>('LzHatirlat')
// Telefonun alarm sistemine yazilir: uygulama kapaliyken de gelir, telefon yeniden baslayinca yeniden kurulur
export async function hatirlatSenkron(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const biletler = await lzDb.biletler.toArray()
    await yerel.kur({ liste: biletler.flatMap((b) => hatirlatmalar(b)).slice(0, 200) })
  } catch {
    /* yok */
  }
}
