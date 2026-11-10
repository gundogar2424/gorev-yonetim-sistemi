import { db, SECIM } from '../yerel/db'

/**
 * Tedarik & termin takibi. Bu veriler programın kendi veritabanındadır;
 * Vega'ya yazılmaz, Vega eşitlemesi de bunlara dokunmaz.
 */

export interface SiparisGirdi {
  urunId: number
  tedarikci: string
  miktar: number
  termin: string | null
}

const SIPARIS = `s.id, s.urun_id AS urunId, s.tedarikci, s.miktar, s.termin, s.durum, s.olusturma,
  (s.termin IS NOT NULL AND s.termin < date('now','localtime')) AS gecikti`

export const urunSiparisleri = (urunId: number) =>
  db.prepare(`SELECT ${SIPARIS} FROM tedarik_siparis s WHERE s.urun_id = ? AND s.durum = 'acik' ORDER BY s.termin IS NULL, s.termin`).all(urunId)

/** Tüm açık siparişler: termini geçenler en üstte, sonra en yakın termin. */
export const acikSiparisler = () =>
  db
    .prepare(
      `SELECT ${SIPARIS}, u.ad AS urunAd, u.kod AS urunKod, u.stok,
              (SELECT g.surum FROM urun_gorsel g WHERE g.urun_id = u.id) AS gorselSurum
       FROM tedarik_siparis s JOIN urun u ON u.id = s.urun_id
       WHERE s.durum = 'acik'
       ORDER BY s.termin IS NULL, s.termin, s.id`,
    )
    .all()

export function siparisEkle(g: SiparisGirdi): number {
  return Number(
    db.prepare('INSERT INTO tedarik_siparis (urun_id, tedarikci, miktar, termin) VALUES (@urunId, @tedarikci, @miktar, @termin)').run(g)
      .lastInsertRowid,
  )
}

export const siparisGuncelle = (id: number, g: Omit<SiparisGirdi, 'urunId'>): boolean =>
  db.prepare(`UPDATE tedarik_siparis SET tedarikci = @tedarikci, miktar = @miktar, termin = @termin WHERE id = @id AND durum = 'acik'`).run({ ...g, id })
    .changes > 0

/** Mal teslim alındı: sipariş "yolda" olmaktan çıkar. Stok artışı Vega'daki girişle gelir. */
export const siparisTeslim = (id: number): boolean =>
  db.prepare(`UPDATE tedarik_siparis SET durum = 'teslim' WHERE id = ? AND durum = 'acik'`).run(id).changes > 0

export const siparisSil = (id: number): boolean => db.prepare('DELETE FROM tedarik_siparis WHERE id = ?').run(id).changes > 0

/** null verilirse programdaki eşik kaldırılır, Vega'dan gelen eşik geçerli olur. */
export function kritikEsikAyarla(urunId: number, esik: number | null): void {
  if (esik === null) db.prepare('DELETE FROM urun_ayar WHERE urun_id = ?').run(urunId)
  else
    db.prepare('INSERT INTO urun_ayar VALUES (?, ?) ON CONFLICT(urun_id) DO UPDATE SET kritik_esik = excluded.kritik_esik').run(urunId, esik)
}

/** Sipariş gerektirenler: Depo Stoğu + Yoldaki Sipariş < Kritik Eşik. En açık olan en üstte. */
export const kritikStok = () =>
  db
    .prepare(
      `SELECT *, kritikEsik - (stok + yoldaki) AS eksik FROM (SELECT ${SECIM} FROM urun u)
       WHERE kritikEsik > 0 AND stok + yoldaki < kritikEsik
       ORDER BY (stok + yoldaki) / kritikEsik, ad`,
    )
    .all()

export const tedarikciler = (): string[] =>
  (db.prepare('SELECT DISTINCT tedarikci AS t FROM tedarik_siparis ORDER BY 1').all() as { t: string }[]).map((s) => s.t)
