// YAKINDA SEVDIGIN MEKAN: gitmek istedigin ya da favori bir mekana yaklasinca ozel bildirim.
// - Mesafe Ayarlar > Kolayliklar'dan: 100, 200 (varsayilan), 500 m. Araba hizinda bu mesafenin 2 kati.
// - Yalnizca yaklasirken (cemberin icine girerken); uzaklasirken ve mekani gectikten sonra gelmez.
// - Gunde en fazla 2 bildirim, ayni mekan icin gunde 1 kez; 22.00-09.00 arasi hic gelmez.
// - Telefonda konum surekli izlenmez: telefonun geofence ozelliği kullanilir (LzYakin eklentisi, pil yemez).
//   Kurallarin aynisi Android tarafinda da uygulanir (uygulama kapaliyken de calisir).
// - Konum izni yoksa hic calismaz.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { liveQuery } from 'dexie'
import { lzDb } from '../db'
import type { LzMekan } from '../types'
import { konumIzniVerildi, mesafeKm, puanYaz } from './mekan'
import { bildir } from './kampanya'
import { dataFotoSikistir } from './image'

const KEY_AYAR = 'lz-yakin-bildirim' // '0' kapali
const KEY_MESAFE = 'lz-yakin-mesafe'
const KEY_SES = 'lz-yakin-ses' // yumusak | guclu (varsayilan) | sesli
const KEY_KAYIT = 'lz-yakin-bildirim-kayit'
export const MESAFE_SECENEK = [100, 200, 500] as const
export const VARSAYILAN_M = 200
export const GUNLUK = 2
export const ARABA_HIZ_MS = 5.5 // ~20 km/sa ve ustu araba sayilir
const EN_FAZLA_MEKAN = 50 // geofence siniri 100; her mekana 2 cember

type YakinYerel = {
  kur(o: { acik: boolean; metre: number; ses: YakinSes; mekanlar: YerelMekan[] }): Promise<void>
  izinDurumu(): Promise<{ konum: boolean; arkaPlan: boolean }>
  izinIste(): Promise<void>
}
interface YerelMekan {
  id: number
  ad: string
  puan: string
  lat: number
  lon: number
  favori: boolean
  foto: string
}
const yerel = registerPlugin<YakinYerel>('LzYakin')

function oku(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function yaz(k: string, v: string): void {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* yok */
  }
}

export function yakinBildirimAcik(): boolean {
  return oku(KEY_AYAR) !== '0'
}
export function yakinBildirimKaydet(v: boolean): void {
  yaz(KEY_AYAR, v ? '1' : '0')
  void yakinSenkron()
}
// Bildirim sesi: Yumusak / Guclu (varsayilan: yuksek oncelik, ozel yuksek ton, 2 uzun titresim) / Sesli soyle (Turkce)
export type YakinSes = 'yumusak' | 'guclu' | 'sesli'
export const SES_SECENEK: { id: YakinSes; ad: string }[] = [
  { id: 'yumusak', ad: 'Yumuşak' },
  { id: 'guclu', ad: 'Güçlü' },
  { id: 'sesli', ad: 'Sesli söyle' }
]
export function yakinSes(): YakinSes {
  const v = oku(KEY_SES)
  return v === 'yumusak' || v === 'sesli' ? v : 'guclu'
}
export function yakinSesKaydet(v: YakinSes): void {
  yaz(KEY_SES, v)
  void yakinSenkron()
}
// "Sesli soyle" cumlesi (Android tarafinda da ayni)
export function yakinSoz(m: Pick<LzMekan, 'favori' | 'gitmekIstiyorum' | 'ad'>): string {
  return `${yakinBaslik(m).replace('★ ', '')}, ${m.ad} var`
}
function tarayicidaSoyle(metin: string): void {
  try {
    const u = new SpeechSynthesisUtterance(metin)
    u.lang = 'tr-TR'
    u.volume = 1
    window.speechSynthesis.speak(u)
  } catch {
    /* yok */
  }
}

export function yakinMesafe(): number {
  const n = Number(oku(KEY_MESAFE))
  return (MESAFE_SECENEK as readonly number[]).includes(n) ? n : VARSAYILAN_M
}
export function yakinMesafeKaydet(m: number): void {
  yaz(KEY_MESAFE, String(m))
  void yakinSenkron()
}

// ---- KURALLAR (Android tarafindaki YakinMotor.java ile ayni) ----
// Hiza gore esik: yuruyuste secilen mesafe, arabada 2 kati
export function yakinEsik(secilenM: number, hizMs: number | null | undefined): number {
  return hizMs != null && hizMs >= ARABA_HIZ_MS ? secilenM * 2 : secilenM
}
export interface YakinDurum {
  secilenM: number
  oncekiM: number | null // bir onceki olcumde mekana uzaklik (bilinmiyorsa null)
  simdiM: number
  hizMs: number | null
  saat: number
  gunlukSayi: number
  bugunBildirildi: boolean // ayni mekan bugun bildirildi ya da "Bugun gosterme" denildi
}
export function bildirimGitsinMi(d: YakinDurum): { git: boolean; neden: string } {
  if (d.saat >= 22 || d.saat < 9) return { git: false, neden: 'gece' }
  if (d.gunlukSayi >= GUNLUK) return { git: false, neden: 'gunluk sinir' }
  if (d.bugunBildirildi) return { git: false, neden: 'bugun bildirildi' }
  const esik = yakinEsik(d.secilenM, d.hizMs)
  if (d.simdiM > esik) return { git: false, neden: 'uzak' }
  // Yalnizca cemberin icine girerken: onceki olcum disaridaysa ve yaklasiyorsa
  if (d.oncekiM == null || d.oncekiM <= esik || d.simdiM >= d.oncekiM) return { git: false, neden: 'yaklasmiyor' }
  return { git: true, neden: '' }
}

// Bildirim metni (Android tarafinda da ayni)
export function yakinBaslik(m: Pick<LzMekan, 'favori' | 'gitmekIstiyorum'>): string {
  return m.favori && !m.gitmekIstiyorum ? '★ Favori mekanın yakınında' : 'Gitmek istediğin mekan yakınında'
}
export function yakinMetin(ad: string, metre: number, puan = ''): string {
  return `${Math.max(10, Math.round(metre / 10) * 10)} m ileride ${ad} var${puan ? ` · ${puan}` : ''}`
}

interface Kayit {
  gun: string
  mekanlar: number[] // bildirilenler
  gizli?: number[] // "Bugun gosterme" denilenler
}
const bugun = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function kayitOku(d = new Date()): Kayit {
  try {
    const k = JSON.parse(oku(KEY_KAYIT) || 'null') as Kayit | null
    if (k && k.gun === bugun(d)) return k
  } catch {
    /* yok */
  }
  return { gun: bugun(d), mekanlar: [] }
}
function kayitYaz(k: Kayit): void {
  yaz(KEY_KAYIT, JSON.stringify(k))
}
export function bugunGosterme(id: number, simdi = new Date()): void {
  const k = kayitOku(simdi)
  k.gizli = [...(k.gizli ?? []), id]
  kayitYaz(k)
}

const adayMi = (m: LzMekan) => (m.gitmekIstiyorum || m.favori) && !m.gidildi && m.lat !== undefined && m.lon !== undefined

// Tarayici yedegi icin: bir konum olcumunde gonderilecek mekanlar. onceki: mekan id -> onceki uzaklik (m)
export async function yakinKontrol(
  k: { lat: number; lon: number; hiz?: number | null },
  simdi = new Date(),
  onceki: Map<number, number> = new Map()
): Promise<number[]> {
  if (!yakinBildirimAcik()) return []
  const kayit = kayitOku(simdi)
  const secilen = yakinMesafe()
  const adaylar = (await lzDb.mekanlar.toArray())
    .filter(adayMi)
    .map((m) => ({ m, metre: Math.round(mesafeKm(k, { lat: m.lat!, lon: m.lon! }) * 1000) }))
    .sort((a, b) => a.metre - b.metre)
  const gonderilen: number[] = []
  for (const { m, metre } of adaylar) {
    const karar = bildirimGitsinMi({
      secilenM: secilen,
      oncekiM: onceki.get(m.id!) ?? null,
      simdiM: metre,
      hizMs: k.hiz ?? null,
      saat: simdi.getHours(),
      gunlukSayi: kayit.mekanlar.length,
      bugunBildirildi: kayit.mekanlar.includes(m.id!) || (kayit.gizli ?? []).includes(m.id!)
    })
    onceki.set(m.id!, metre)
    if (!karar.git) continue
    const ses = yakinSes()
    await bildir(yakinBaslik(m), yakinMetin(m.ad, metre, puanYaz(m)), 7000 + (m.id! % 1000), `/mekan/${m.id}`, ses === 'yumusak')
    // Gece kurali bildirimGitsinMi'de: 22.00-09.00 arasi buraya gelinmez, sesli soyleme de calismaz
    if (ses === 'sesli') tarayicidaSoyle(yakinSoz(m))
    else if (ses === 'guclu') navigator.vibrate?.([700, 350, 700])
    kayit.mekanlar.push(m.id!)
    gonderilen.push(m.id!)
    kayitYaz(kayit)
  }
  return gonderilen
}

// ---- IZIN ----
export async function yakinIzinDurumu(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      return (await yerel.izinDurumu()).konum
    } catch {
      return false
    }
  }
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (p) return p.state === 'granted'
  } catch {
    /* yok */
  }
  return konumIzniVerildi()
}
export async function yakinIzinIste(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await yerel.izinIste()
    } catch {
      /* yok */
    }
    return
  }
  await new Promise<void>((res) =>
    navigator.geolocation?.getCurrentPosition(
      () => {
        yaz('lz-konum-izin', '1')
        res()
      },
      () => res(),
      { timeout: 15000 }
    ) ?? res()
  )
}

// ---- TELEFON: geofence listesini kur ----
const kucukFoto = new Map<string, string>()
async function fotoKucult(m: LzMekan): Promise<string> {
  if (!m.foto) return ''
  const anahtar = `${m.id}|${m.foto.length}|${m.foto.slice(-32)}`
  if (kucukFoto.has(anahtar)) return kucukFoto.get(anahtar)!
  let f = ''
  try {
    f = m.foto.startsWith('data:') ? await dataFotoSikistir(m.foto, 360, 0.7) : ''
  } catch {
    f = ''
  }
  kucukFoto.set(anahtar, f)
  return f
}
let sonGonderilen = ''
export async function yakinSenkron(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const acik = yakinBildirimAcik()
  let son: { lat: number; lon: number } | null = null
  try {
    son = JSON.parse(oku('lz-son-konum') || 'null')
  } catch {
    son = null
  }
  const hepsi = acik ? (await lzDb.mekanlar.toArray()).filter(adayMi) : []
  const sirali = son ? hepsi.sort((a, b) => mesafeKm(son!, { lat: a.lat!, lon: a.lon! }) - mesafeKm(son!, { lat: b.lat!, lon: b.lon! })) : hepsi
  const mekanlar: YerelMekan[] = []
  for (const m of sirali.slice(0, EN_FAZLA_MEKAN))
    mekanlar.push({ id: m.id!, ad: m.ad, puan: puanYaz(m), lat: m.lat!, lon: m.lon!, favori: !!m.favori && !m.gitmekIstiyorum, foto: await fotoKucult(m) })
  const imza = JSON.stringify([acik, yakinMesafe(), yakinSes(), mekanlar.map((x) => [x.id, x.lat, x.lon, x.favori, x.puan, x.foto.length])])
  if (imza === sonGonderilen) return
  sonGonderilen = imza
  try {
    await yerel.kur({ acik, metre: yakinMesafe(), ses: yakinSes(), mekanlar })
  } catch {
    sonGonderilen = ''
  }
}

// Uygulama acilinca: telefonda geofence listesi kurulur ve mekanlar degistikce yenilenir (konum izlenmez).
// Tarayicida geofence olmadigi icin yedek olarak konum izlenir (yalnizca izin daha once verildiyse).
export function yakinIzle(): () => void {
  if (Capacitor.isNativePlatform()) {
    let t: ReturnType<typeof setTimeout> | undefined
    const abone = liveQuery(() => lzDb.mekanlar.toArray()).subscribe({
      next: () => {
        clearTimeout(t)
        t = setTimeout(() => void yakinSenkron(), 2000)
      }
    })
    return () => {
      clearTimeout(t)
      abone.unsubscribe()
    }
  }
  if (!konumIzniVerildi() || !navigator.geolocation || !yakinBildirimAcik()) return () => {}
  let son = 0
  const onceki = new Map<number, number>()
  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (Date.now() - son < 30000) return
      son = Date.now()
      void yakinKontrol({ lat: p.coords.latitude, lon: p.coords.longitude, hiz: p.coords.speed }, new Date(), onceki)
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 }
  )
  return () => navigator.geolocation.clearWatch(id)
}
