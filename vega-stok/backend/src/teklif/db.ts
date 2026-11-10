import { iskontoCoz, teklifHesapla, type TeklifSonucu } from '../../../ortak/teklif-hesap'
import { GirdiHatasi } from '../girdi'
import { db, metaOku, metaYaz } from '../yerel/db'

export interface TeklifKalemi {
  urunId: number | null
  kod: string | null
  ad: string
  miktar: number
  birimFiyat: number
  iskonto: string
  kdv: number
}

export interface TeklifGirdi {
  musteriAd: string
  musteriTelefon: string | null
  musteriAdres: string | null
  genelIskonto: string
  kdvDahil: boolean
  gecerlilikGun: number
  notu: string | null
  kalemler: TeklifKalemi[]
}

export interface Teklif extends TeklifGirdi {
  id: number
  no: string
  tarih: string
  hesap: TeklifSonucu
}

export interface Firma {
  ad: string
  adres: string
  telefon: string
  eposta: string
  vergi: string
  /** Vega'daki satış fiyatları KDV dahil mi? Yeni tekliflerin varsayılanı. */
  fiyatlarKdvDahil: boolean
}

const BOS_FIRMA: Firma = { ad: '', adres: '', telefon: '', eposta: '', vergi: '', fiyatlarKdvDahil: false }

export const firmaOku = (): Firma => ({ ...BOS_FIRMA, ...(JSON.parse(metaOku('firma') ?? '{}') as Partial<Firma>) })

export function firmaYaz(govde: unknown): Firma {
  const g = (govde ?? {}) as Record<string, unknown>
  const metin = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 300) : '')
  const firma: Firma = {
    ad: metin(g.ad), adres: metin(g.adres), telefon: metin(g.telefon), eposta: metin(g.eposta), vergi: metin(g.vergi),
    fiyatlarKdvDahil: g.fiyatlarKdvDahil === true,
  }
  metaYaz('firma', JSON.stringify(firma))
  return firma
}

/** İstek gövdesini doğrulayıp temiz bir teklif girdisine çevirir. */
export function teklifOku(govde: unknown): TeklifGirdi {
  const g = (govde ?? {}) as Record<string, unknown>
  const metin = (v: unknown, uzunluk = 300) => (typeof v === 'string' ? v.trim().slice(0, uzunluk) : '')
  const musteriAd = metin(g.musteriAd)
  if (!musteriAd) throw new GirdiHatasi('Müşteri adı gerekli')
  const genelIskonto = metin(g.genelIskonto, 40)
  if (iskontoCoz(genelIskonto) === null) throw new GirdiHatasi('Genel iskonto geçersiz (örnek: 10+5)')
  const gecerlilikGun = g.gecerlilikGun == null ? 15 : Number(g.gecerlilikGun)
  if (!Number.isInteger(gecerlilikGun) || gecerlilikGun < 1 || gecerlilikGun > 365) throw new GirdiHatasi('Geçerlilik süresi 1–365 gün olmalı')
  if (!Array.isArray(g.kalemler) || g.kalemler.length === 0) throw new GirdiHatasi('Teklifte en az bir ürün olmalı')
  if (g.kalemler.length > 500) throw new GirdiHatasi('Teklifte en çok 500 kalem olabilir')

  const kalemler = (g.kalemler as Record<string, unknown>[]).map((k, i): TeklifKalemi => {
    const satir = `${i + 1}. satır`
    const ad = metin(k?.ad)
    const miktar = Number(k?.miktar)
    const birimFiyat = Number(k?.birimFiyat)
    const kdv = Number(k?.kdv)
    const iskonto = metin(k?.iskonto, 40)
    const urunId = k?.urunId == null ? null : Number(k.urunId)
    if (!ad) throw new GirdiHatasi(`${satir}: ürün adı gerekli`)
    if (!Number.isFinite(miktar) || miktar <= 0) throw new GirdiHatasi(`${satir}: miktar sıfırdan büyük olmalı`)
    if (!Number.isFinite(birimFiyat) || birimFiyat < 0) throw new GirdiHatasi(`${satir}: birim fiyat geçersiz`)
    if (!Number.isFinite(kdv) || kdv < 0 || kdv > 100) throw new GirdiHatasi(`${satir}: KDV oranı geçersiz`)
    if (iskontoCoz(iskonto) === null) throw new GirdiHatasi(`${satir}: iskonto geçersiz (örnek: 10+5)`)
    if (urunId !== null && !Number.isInteger(urunId)) throw new GirdiHatasi(`${satir}: ürün geçersiz`)
    return { urunId, kod: metin(k?.kod, 60) || null, ad, miktar, birimFiyat, iskonto, kdv }
  })

  return {
    musteriAd, musteriTelefon: metin(g.musteriTelefon, 40) || null, musteriAdres: metin(g.musteriAdres) || null,
    genelIskonto, kdvDahil: g.kdvDahil === true, gecerlilikGun, notu: metin(g.notu, 1000) || null, kalemler,
  }
}

const hesapla = (t: TeklifGirdi) => teklifHesapla(t.kalemler, t.genelIskonto, t.kdvDahil)

const kalemYaz = db.prepare(`INSERT INTO teklif_kalem (teklif_id, sira, urun_id, kod, ad, miktar, birim_fiyat, iskonto, kdv)
  VALUES (@teklifId, @sira, @urunId, @kod, @ad, @miktar, @birimFiyat, @iskonto, @kdv)`)

function kalemleriYaz(teklifId: number, kalemler: TeklifKalemi[]) {
  db.prepare('DELETE FROM teklif_kalem WHERE teklif_id = ?').run(teklifId)
  kalemler.forEach((k, sira) => kalemYaz.run({ ...k, teklifId, sira }))
}

const alanlar = (t: TeklifGirdi) => ({
  musteriAd: t.musteriAd, musteriTelefon: t.musteriTelefon, musteriAdres: t.musteriAdres, genelIskonto: t.genelIskonto,
  kdvDahil: t.kdvDahil ? 1 : 0, gecerlilikGun: t.gecerlilikGun, notu: t.notu, genelToplam: hesapla(t).genelToplam,
})

export const teklifEkle = db.transaction((t: TeklifGirdi): number => {
  const tarih = new Date().toLocaleDateString('sv-SE')
  const yil = tarih.slice(0, 4)
  // Yıl içinde sıradaki numara: T-2026-0001, T-2026-0002 ...
  const son = (db.prepare(`SELECT MAX(CAST(substr(no, 8) AS INTEGER)) AS n FROM teklif WHERE no LIKE ?`).get(`T-${yil}-%`) as { n: number | null }).n ?? 0
  const id = Number(
    db
      .prepare(
        `INSERT INTO teklif (no, tarih, musteri_ad, musteri_telefon, musteri_adres, genel_iskonto, kdv_dahil, gecerlilik_gun, notu, genel_toplam)
         VALUES (@no, @tarih, @musteriAd, @musteriTelefon, @musteriAdres, @genelIskonto, @kdvDahil, @gecerlilikGun, @notu, @genelToplam)`,
      )
      .run({ ...alanlar(t), no: `T-${yil}-${String(son + 1).padStart(4, '0')}`, tarih }).lastInsertRowid,
  )
  kalemleriYaz(id, t.kalemler)
  return id
})

export const teklifGuncelle = db.transaction((id: number, t: TeklifGirdi): boolean => {
  const degisti = db
    .prepare(
      `UPDATE teklif SET musteri_ad=@musteriAd, musteri_telefon=@musteriTelefon, musteri_adres=@musteriAdres, genel_iskonto=@genelIskonto,
         kdv_dahil=@kdvDahil, gecerlilik_gun=@gecerlilikGun, notu=@notu, genel_toplam=@genelToplam WHERE id=@id`,
    )
    .run({ ...alanlar(t), id }).changes
  if (degisti) kalemleriYaz(id, t.kalemler)
  return degisti > 0
})

export const teklifSil = (id: number): boolean => db.prepare('DELETE FROM teklif WHERE id = ?').run(id).changes > 0

export function teklifGetir(id: number): Teklif | null {
  const t = db
    .prepare(
      `SELECT id, no, tarih, musteri_ad AS musteriAd, musteri_telefon AS musteriTelefon, musteri_adres AS musteriAdres,
              genel_iskonto AS genelIskonto, kdv_dahil AS kdvDahil, gecerlilik_gun AS gecerlilikGun, notu FROM teklif WHERE id = ?`,
    )
    .get(id) as (Omit<Teklif, 'kalemler' | 'hesap' | 'kdvDahil'> & { kdvDahil: number }) | undefined
  if (!t) return null
  const kalemler = db
    .prepare(
      `SELECT urun_id AS urunId, kod, ad, miktar, birim_fiyat AS birimFiyat, iskonto, kdv,
              (SELECT g.surum FROM urun_gorsel g WHERE g.urun_id = teklif_kalem.urun_id) AS gorselSurum
       FROM teklif_kalem WHERE teklif_id = ? ORDER BY sira`,
    )
    .all(id) as TeklifKalemi[]
  const teklif = { ...t, kdvDahil: t.kdvDahil === 1, kalemler }
  return { ...teklif, hesap: hesapla(teklif) }
}

export const teklifListesi = () =>
  db
    .prepare(
      `SELECT t.id, t.no, t.tarih, t.musteri_ad AS musteriAd, t.genel_toplam AS genelToplam,
              (SELECT COUNT(*) FROM teklif_kalem k WHERE k.teklif_id = t.id) AS kalemSayisi
       FROM teklif t ORDER BY t.id DESC LIMIT 200`,
    )
    .all()

/** Daha önce teklif verilen müşteriler (en son kullanılan bilgileriyle). */
export const musteriler = () =>
  db
    .prepare(
      `SELECT musteri_ad AS ad, musteri_telefon AS telefon, musteri_adres AS adres FROM teklif
       WHERE id IN (SELECT MAX(id) FROM teklif GROUP BY musteri_ad) ORDER BY musteri_ad`,
    )
    .all()
