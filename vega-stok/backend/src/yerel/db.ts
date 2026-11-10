import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config'
import type { VegaUrun } from '../vega/sorgular'

/**
 * Yerel önbellek (SQLite). Arayüz HİÇBİR ZAMAN Vega'ya sorgu atmaz; tüm arama ve
 * listeleme buradan milisaniyeler içinde yanıtlanır. Vega'da olmayan kendi
 * verilerimiz (görseller, termin, teklifler) de ileride bu veritabanında duracak.
 */

if (config.yerelDb !== ':memory:') mkdirSync(dirname(config.yerelDb), { recursive: true })
export const db = new Database(config.yerelDb)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS urun (
    id INTEGER PRIMARY KEY,           -- Vega stok kartı kimliği
    kod TEXT NOT NULL, ad TEXT NOT NULL,
    barkod TEXT, marka TEXT, kategori TEXT, olcu TEXT, raf TEXT,
    kdv REAL, satis_fiyati REAL, alis_fiyati REAL, kritik_esik REAL,
    stok REAL NOT NULL DEFAULT 0,
    ozet TEXT NOT NULL                -- kart içeriğinin özeti: değişmeyen satır yeniden yazılmaz
  );
  CREATE INDEX IF NOT EXISTS urun_barkod ON urun(barkod);
  CREATE INDEX IF NOT EXISTS urun_marka ON urun(marka);
  CREATE INDEX IF NOT EXISTS urun_kategori ON urun(kategori);
  CREATE VIRTUAL TABLE IF NOT EXISTS urun_ara USING fts5(metin, prefix='1 2 3');
  CREATE TABLE IF NOT EXISTS meta (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL);
`)

/** Türkçe duyarsız arama için: "ÇİVİ Şapkalı" → "civi sapkali" */
export function sadelestir(metin: string): string {
  return metin
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

export const metaOku = (anahtar: string): string | undefined =>
  (db.prepare('SELECT deger FROM meta WHERE anahtar = ?').get(anahtar) as { deger: string } | undefined)?.deger

export const metaYaz = (anahtar: string, deger: string | number): void => {
  db.prepare('INSERT INTO meta VALUES (?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger').run(anahtar, String(deger))
}

const urunYaz = db.prepare(`
  INSERT INTO urun (id, kod, ad, barkod, marka, kategori, olcu, raf, kdv, satis_fiyati, alis_fiyati, kritik_esik, ozet)
  VALUES (@id, @kod, @ad, @barkod, @marka, @kategori, @olcu, @raf, @kdv, @satisFiyati, @alisFiyati, @kritikEsik, @ozet)
  ON CONFLICT(id) DO UPDATE SET kod=excluded.kod, ad=excluded.ad, barkod=excluded.barkod, marka=excluded.marka,
    kategori=excluded.kategori, olcu=excluded.olcu, raf=excluded.raf, kdv=excluded.kdv,
    satis_fiyati=excluded.satis_fiyati, alis_fiyati=excluded.alis_fiyati, kritik_esik=excluded.kritik_esik, ozet=excluded.ozet`)
const araSil = db.prepare('DELETE FROM urun_ara WHERE rowid = ?')
const araYaz = db.prepare('INSERT INTO urun_ara (rowid, metin) VALUES (?, ?)')
const urunSil = db.prepare('DELETE FROM urun WHERE id = ?')

const kirp = (v: unknown): string | null => {
  const s = v == null ? '' : String(v).trim()
  return s === '' ? null : s
}

/** Vega'dan gelen kartları yerelle karşılaştırır; yalnızca farkları yazar. */
export const urunleriUygula = db.transaction((gelen: VegaUrun[]) => {
  const eski = new Map<number, string>()
  for (const s of db.prepare('SELECT id, ozet FROM urun').all() as { id: number; ozet: string }[]) eski.set(s.id, s.ozet)

  let degisen = 0
  for (const g of gelen) {
    const u = {
      ...g,
      kod: kirp(g.kod) ?? '', ad: kirp(g.ad) ?? '',
      barkod: kirp(g.barkod), marka: kirp(g.marka), kategori: kirp(g.kategori), olcu: kirp(g.olcu), raf: kirp(g.raf),
    }
    const ozet = JSON.stringify(u)
    const onceki = eski.get(u.id)
    eski.delete(u.id)
    if (onceki === ozet) continue
    urunYaz.run({ ...u, ozet })
    araSil.run(u.id)
    araYaz.run(u.id, sadelestir([u.kod, u.ad, u.barkod, u.marka, u.kategori, u.olcu].filter(Boolean).join(' ')))
    degisen++
  }
  // Vega'dan silinmiş kartlar
  for (const id of eski.keys()) {
    urunSil.run(id)
    araSil.run(id)
  }
  return { degisen, silinen: eski.size }
})

const stokYaz = db.prepare('UPDATE urun SET stok = @stok WHERE id = @id AND stok <> @stok')

/**
 * Bakiyeleri yazar. `kapsam` verilirse (hızlı tur) sonuçta gelmeyen kapsam içi
 * kartlar 0'lanır; verilmezse (tam tur) sonuçta olmayan TÜM kartlar 0'lanır.
 */
export const stoklariUygula = db.transaction((gelen: { id: number; stok: number }[], kapsam?: number[]) => {
  const gelenler = new Map(gelen.map((g) => [g.id, g.stok ?? 0]))
  const hedef = kapsam ?? (db.prepare('SELECT id FROM urun').all() as { id: number }[]).map((s) => s.id)
  let degisen = 0
  for (const id of hedef) degisen += stokYaz.run({ id, stok: gelenler.get(id) ?? 0 }).changes
  return degisen
})

export interface UrunFiltre {
  q?: string
  marka?: string
  kategori?: string
  olcu?: string
  limit?: number
}

const SECIM = `u.id, u.kod, u.ad, u.barkod, u.marka, u.kategori, u.olcu, u.raf, u.kdv,
  u.satis_fiyati AS satisFiyati, u.kritik_esik AS kritikEsik, u.stok`

/** Anlık arama: her kelime önek olarak aranır ("civ 4x" → "civi ... 4x40"). */
export function urunAra(f: UrunFiltre) {
  const kosul: string[] = []
  const p: Record<string, string | number> = { limit: Math.min(Math.max(f.limit ?? 60, 1), 200) }
  const kelimeler = sadelestir(f.q ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (kelimeler.length) {
    kosul.push('u.id IN (SELECT rowid FROM urun_ara WHERE urun_ara MATCH @ara)')
    p.ara = kelimeler.map((k) => `"${k}"*`).join(' ')
  }
  for (const alan of ['marka', 'kategori', 'olcu'] as const) {
    if (f[alan]) {
      kosul.push(`u.${alan} = @${alan}`)
      p[alan] = f[alan]
    }
  }
  return db
    .prepare(`SELECT ${SECIM} FROM urun u ${kosul.length ? 'WHERE ' + kosul.join(' AND ') : ''} ORDER BY u.ad LIMIT @limit`)
    .all(p)
}

/** El terminali: barkod (bulunamazsa stok kodu) ile tek ürün. */
export function urunBarkodla(kod: string) {
  return db.prepare(`SELECT ${SECIM} FROM urun u WHERE u.barkod = @kod OR u.kod = @kod LIMIT 1`).get({ kod: kod.trim() })
}

export function filtreSecenekleri() {
  const liste = (alan: string) =>
    (db.prepare(`SELECT DISTINCT ${alan} AS v FROM urun WHERE ${alan} IS NOT NULL ORDER BY 1`).all() as { v: string }[]).map((s) => s.v)
  return { markalar: liste('marka'), kategoriler: liste('kategori'), olculer: liste('olcu') }
}
