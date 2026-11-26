// YAKINDA SEVDIGIN MEKAN: gitmek istedigin ya da favori bir mekana 200 m yaklasinca bir kez sessiz bildirim.
// Gunde en fazla 2 bildirim, ayni mekan icin gunde 1 kez; 22.00-09.00 arasi yok. Dokununca mekanin sayfasi acilir.
// Uygulama acikken (ya da arka planda calismaya devam ederken) konum izlenir; konum izni daha once verilmediyse hic sorulmaz.
import { lzDb } from '../db'
import { mesafeKm } from './mekan'
import { bildir } from './kampanya'

const KEY_AYAR = 'lz-yakin-bildirim' // '0' kapali
const KEY_KAYIT = 'lz-yakin-bildirim-kayit'
const MESAFE_M = 200
const GUNLUK = 2

export function yakinBildirimAcik(): boolean {
  try {
    return localStorage.getItem(KEY_AYAR) !== '0'
  } catch {
    return true
  }
}
export function yakinBildirimKaydet(v: boolean): void {
  try {
    localStorage.setItem(KEY_AYAR, v ? '1' : '0')
  } catch {
    /* yok */
  }
}

interface Kayit {
  gun: string
  mekanlar: number[]
}
const bugun = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function kayitOku(d = new Date()): Kayit {
  try {
    const k = JSON.parse(localStorage.getItem(KEY_KAYIT) || 'null') as Kayit | null
    if (k && k.gun === bugun(d)) return k
  } catch {
    /* yok */
  }
  return { gun: bugun(d), mekanlar: [] }
}
function kayitYaz(k: Kayit): void {
  try {
    localStorage.setItem(KEY_KAYIT, JSON.stringify(k))
  } catch {
    /* yok */
  }
}

// Bu konumda bildirim gonderilecek mekanlar (kurallar burada; test edilebilir)
export async function yakinKontrol(k: { lat: number; lon: number }, simdi = new Date()): Promise<number[]> {
  if (!yakinBildirimAcik()) return []
  const saat = simdi.getHours()
  if (saat >= 22 || saat < 9) return []
  const kayit = kayitOku(simdi)
  if (kayit.mekanlar.length >= GUNLUK) return []
  const adaylar = (await lzDb.mekanlar.toArray())
    .filter((m) => (m.gitmekIstiyorum || m.favori) && !m.gidildi && m.lat !== undefined && m.lon !== undefined && !kayit.mekanlar.includes(m.id!))
    .map((m) => ({ m, metre: Math.round(mesafeKm(k, { lat: m.lat!, lon: m.lon! }) * 1000) }))
    .filter((x) => x.metre <= MESAFE_M)
    .sort((a, b) => a.metre - b.metre)
  const gonderilen: number[] = []
  for (const { m, metre } of adaylar) {
    if (kayit.mekanlar.length >= GUNLUK) break
    const ne = m.gitmekIstiyorum ? 'Gitmek istediğin' : 'Favori mekanın'
    await bildir(`${Math.max(10, Math.round(metre / 10) * 10)} m ileride ${ne} ${m.ad} var`, 'Göster', 7000 + (m.id! % 1000), `/mekan/${m.id}`, true)
    kayit.mekanlar.push(m.id!)
    gonderilen.push(m.id!)
    kayitYaz(kayit)
  }
  return gonderilen
}

// Konum izleme: yalnizca izin daha once verildiyse (lz-konum-izin) ve ozellik aciksa. Donen islev durdurur.
export function yakinIzle(): () => void {
  let izin = false
  try {
    izin = localStorage.getItem('lz-konum-izin') === '1'
  } catch {
    /* yok */
  }
  if (!izin || !navigator.geolocation || !yakinBildirimAcik()) return () => {}
  let son = 0
  const id = navigator.geolocation.watchPosition(
    (p) => {
      // Pil icin en fazla 30 sn'de bir kontrol
      if (Date.now() - son < 30000) return
      son = Date.now()
      void yakinKontrol({ lat: p.coords.latitude, lon: p.coords.longitude })
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 }
  )
  return () => navigator.geolocation.clearWatch(id)
}
