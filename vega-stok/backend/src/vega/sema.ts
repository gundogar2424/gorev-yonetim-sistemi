import { config } from '../config'

/**
 * Vega tablo / kolon eşlemesi — Vega'ya özgü HER isim yalnızca bu dosyadadır.
 *
 * DİKKAT: Aşağıdaki isimler VegaWin'in yaygın düzenine göre yazılmış
 * VARSAYIMLARDIR; sürüme ve kuruluma göre değişir. İlk kurulumda
 *     npm run vega:kesif
 * çalıştırın: gerçek tablo/kolonları listeler ve bu eşlemedeki hataları gösterir.
 * Vega'da karşılığı olmayan bir alan için değeri `null` yapın (sorguda NULL döner).
 */

const F = `F${config.vega.firma}` // firma geneli tablolar
const D = `${F}D${config.vega.donem}` // döneme bağlı tablolar

export const sema = {
  stok: {
    tablo: `${F}TBLSTOKLAR`,
    id: 'IND',
    kod: 'STOKKODU',
    ad: 'MALINCINSI',
    barkod: 'BARKODU' as string | null,
    marka: 'KOD1' as string | null,
    kategori: 'KOD2' as string | null,
    olcu: 'KOD3' as string | null,
    raf: 'KOD4' as string | null,
    kdv: 'KDV' as string | null,
    satisFiyati: 'SATISFIYATI1' as string | null,
    alisFiyati: 'ALISFIYATI1' as string | null,
    kritikEsik: 'MINSTOK' as string | null,
  },
  hareket: {
    tablo: `${D}TBLSTOKHAREKETLERI`,
    id: 'IND', // artan kimlik: "son eşitlemeden beri ne değişti" bununla bulunur
    stokId: 'STOKNO',
    miktar: 'MIKTAR',
    /** Satırın GİRİŞ olduğu koşul (takma ad: h). Diğer tüm satırlar çıkış sayılır. */
    girisKosulu: 'h.ISLEMTIPI = 0',
  },
}

const GECERLI_AD = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Tablo/kolon adını doğrulayıp köşeli parantezle döndürür. */
export function ad(isim: string): string {
  if (!GECERLI_AD.test(isim)) throw new Error(`Geçersiz Vega tablo/kolon adı: "${isim}"`)
  return `[${isim}]`
}

/** `s.[KOLON] AS takma` — kolon eşlenmemişse `NULL AS takma`. */
export function kolon(onek: string, isim: string | null, takma: string): string {
  return `${isim ? `${onek}.${ad(isim)}` : 'NULL'} AS ${ad(takma)}`
}
