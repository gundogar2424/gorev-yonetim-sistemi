import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { GirdiHatasi } from '../girdi'
import { db } from '../yerel/db'

export const ROLLER = ['yonetici', 'satis', 'depo'] as const
export type Rol = (typeof ROLLER)[number]

export interface Kullanici {
  id: number
  kullaniciAdi: string
  ad: string
  rol: Rol
  aktif: boolean
}

const OTURUM_SN = 30 * 24 * 3600 // kullanıldıkça uzar; 30 gün hiç girilmezse biter
const simdi = () => Math.floor(Date.now() / 1000)
const ozet = (anahtar: string) => createHash('sha256').update(anahtar).digest('hex')

function sifreOzetle(sifre: string): string {
  const tuz = randomBytes(16)
  return `scrypt$${tuz.toString('hex')}$${scryptSync(sifre, tuz, 64).toString('hex')}`
}

function sifreDogru(sifre: string, kayitli: string): boolean {
  const [, tuz, beklenen] = kayitli.split('$')
  if (!tuz || !beklenen) return false
  return timingSafeEqual(scryptSync(sifre, Buffer.from(tuz, 'hex'), 64), Buffer.from(beklenen, 'hex'))
}

const SECIM = 'id, kullanici_adi AS kullaniciAdi, ad, rol, aktif'
type Satir = Omit<Kullanici, 'aktif'> & { aktif: number }
const cevir = (s: Satir | undefined): Kullanici | null => (s ? { ...s, aktif: s.aktif === 1 } : null)

export const kullaniciSayisi = (): number => (db.prepare('SELECT COUNT(*) AS n FROM kullanici').get() as { n: number }).n
export const kullanicilar = (): Kullanici[] =>
  (db.prepare(`SELECT ${SECIM} FROM kullanici ORDER BY aktif DESC, ad`).all() as Satir[]).map((s) => cevir(s)!)

// --- Girdi doğrulama ---
const metin = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function adiOku(v: unknown): string {
  const adi = metin(v).toLocaleLowerCase('tr-TR')
  if (!/^[a-z0-9._-]{3,30}$/.test(adi)) throw new GirdiHatasi('Kullanıcı adı 3–30 karakter olmalı; yalnızca küçük İngilizce harf, rakam, nokta, tire')
  return adi
}
function sifreOku(v: unknown): string {
  if (typeof v !== 'string' || v.length < 6 || v.length > 200) throw new GirdiHatasi('Şifre en az 6 karakter olmalı')
  return v
}
function rolOku(v: unknown): Rol {
  if (!ROLLER.includes(v as Rol)) throw new GirdiHatasi('Rol geçersiz')
  return v as Rol
}
function adOku(v: unknown): string {
  const ad = metin(v).slice(0, 80)
  if (!ad) throw new GirdiHatasi('Ad soyad gerekli')
  return ad
}

export function kullaniciEkle(govde: unknown): number {
  const g = (govde ?? {}) as Record<string, unknown>
  const yeni = { kullaniciAdi: adiOku(g.kullaniciAdi), ad: adOku(g.ad), rol: rolOku(g.rol), sifreOzet: sifreOzetle(sifreOku(g.sifre)) }
  if (db.prepare('SELECT 1 FROM kullanici WHERE kullanici_adi = ?').get(yeni.kullaniciAdi)) throw new GirdiHatasi('Bu kullanıcı adı zaten var')
  return Number(db.prepare('INSERT INTO kullanici (kullanici_adi, ad, rol, sifre_ozet) VALUES (@kullaniciAdi, @ad, @rol, @sifreOzet)').run(yeni).lastInsertRowid)
}

/** Ad, rol, aktiflik ve (verilmişse) şifreyi günceller. Sistemde en az bir aktif yönetici kalmalıdır. */
export const kullaniciGuncelle = db.transaction((id: number, govde: unknown): boolean => {
  const g = (govde ?? {}) as Record<string, unknown>
  const eski = cevir(db.prepare(`SELECT ${SECIM} FROM kullanici WHERE id = ?`).get(id) as Satir | undefined)
  if (!eski) return false
  const ad = adOku(g.ad)
  const rol = rolOku(g.rol)
  const aktif = g.aktif !== false
  const yeniSifre = g.sifre == null || g.sifre === '' ? null : sifreOku(g.sifre)

  const yoneticiydi = eski.rol === 'yonetici' && eski.aktif
  const baskaYonetici = (db.prepare(`SELECT COUNT(*) AS n FROM kullanici WHERE rol = 'yonetici' AND aktif = 1 AND id <> ?`).get(id) as { n: number }).n
  if (yoneticiydi && !(rol === 'yonetici' && aktif) && baskaYonetici === 0) throw new GirdiHatasi('Son yöneticinin yetkisi kaldırılamaz')

  db.prepare('UPDATE kullanici SET ad = ?, rol = ?, aktif = ? WHERE id = ?').run(ad, rol, aktif ? 1 : 0, id)
  if (yeniSifre) db.prepare('UPDATE kullanici SET sifre_ozet = ? WHERE id = ?').run(sifreOzetle(yeniSifre), id)
  // Yetkisi ya da şifresi değişen kullanıcının açık oturumları kapanır
  if (yeniSifre || !aktif || rol !== eski.rol) db.prepare('DELETE FROM oturum WHERE kullanici_id = ?').run(id)
  return true
})

/** Kullanıcının kendi şifresini değiştirmesi; diğer cihazlardaki oturumları kapanır. */
export function sifreDegistir(kullaniciId: number, gecerliAnahtar: string, govde: unknown): void {
  const g = (govde ?? {}) as Record<string, unknown>
  const kayitli = (db.prepare('SELECT sifre_ozet AS o FROM kullanici WHERE id = ?').get(kullaniciId) as { o: string }).o
  if (typeof g.eski !== 'string' || !sifreDogru(g.eski, kayitli)) throw new GirdiHatasi('Mevcut şifre yanlış')
  db.prepare('UPDATE kullanici SET sifre_ozet = ? WHERE id = ?').run(sifreOzetle(sifreOku(g.yeni)), kullaniciId)
  db.prepare('DELETE FROM oturum WHERE kullanici_id = ? AND anahtar_ozet <> ?').run(kullaniciId, ozet(gecerliAnahtar))
}

// --- Oturumlar ---
// Art arda hatalı girişte kullanıcı adı 1 dakika kilitlenir (şifre deneme saldırılarına karşı)
const hatalar = new Map<string, { sayi: number; kilit: number }>()

/** Başarılıysa oturum anahtarını döndürür (çereze yazılır). */
export function girisYap(govde: unknown): { anahtar: string; kullanici: Kullanici } {
  const g = (govde ?? {}) as Record<string, unknown>
  const adi = metin(g.kullaniciAdi).toLocaleLowerCase('tr-TR')
  const kayit = hatalar.get(adi)
  if (kayit && kayit.kilit > Date.now()) throw new GirdiHatasi('Çok fazla hatalı deneme. 1 dakika sonra yeniden deneyin.')

  const satir = db.prepare(`SELECT ${SECIM}, sifre_ozet AS sifreOzet FROM kullanici WHERE kullanici_adi = ?`).get(adi) as (Satir & { sifreOzet: string }) | undefined
  if (!satir || satir.aktif !== 1 || typeof g.sifre !== 'string' || !sifreDogru(g.sifre, satir.sifreOzet)) {
    const sayi = (kayit?.sayi ?? 0) + 1
    hatalar.set(adi, { sayi: sayi >= 5 ? 0 : sayi, kilit: sayi >= 5 ? Date.now() + 60_000 : 0 })
    throw new GirdiHatasi('Kullanıcı adı veya şifre hatalı')
  }
  hatalar.delete(adi)
  db.prepare('DELETE FROM oturum WHERE bitis < ?').run(simdi()) // süresi dolanları temizle
  const anahtar = randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO oturum VALUES (?, ?, ?)').run(ozet(anahtar), satir.id, simdi() + OTURUM_SN)
  const { sifreOzet: _, ...kullanici } = satir
  return { anahtar, kullanici: cevir(kullanici)! }
}

export function oturumKullanicisi(anahtar: string | undefined): Kullanici | null {
  if (!anahtar) return null
  const o = ozet(anahtar)
  const satir = db
    .prepare(
      `SELECT k.id, k.kullanici_adi AS kullaniciAdi, k.ad, k.rol, k.aktif, o.bitis FROM oturum o JOIN kullanici k ON k.id = o.kullanici_id
       WHERE o.anahtar_ozet = ? AND o.bitis > ? AND k.aktif = 1`,
    )
    .get(o, simdi()) as (Satir & { bitis: number }) | undefined
  if (!satir) return null
  // Süreyi günde en çok bir kez uzat (her istekte veritabanına yazmamak için)
  if (satir.bitis - simdi() < OTURUM_SN - 86_400) db.prepare('UPDATE oturum SET bitis = ? WHERE anahtar_ozet = ?').run(simdi() + OTURUM_SN, o)
  const { bitis: _, ...kullanici } = satir
  return cevir(kullanici)
}

export const cikisYap = (anahtar: string | undefined): void => {
  if (anahtar) db.prepare('DELETE FROM oturum WHERE anahtar_ozet = ?').run(ozet(anahtar))
}

export const OTURUM_SURESI_SN = OTURUM_SN
