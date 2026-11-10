import { vegaSorgu } from './baglanti'
import { ad, kolon, sema } from './sema'

export interface VegaUrun {
  id: number
  kod: string
  ad: string
  barkod: string | null
  marka: string | null
  kategori: string | null
  olcu: string | null
  raf: string | null
  kdv: number | null
  satisFiyati: number | null
  alisFiyati: number | null
  kritikEsik: number | null
}

export interface VegaStok {
  id: number
  stok: number
}

/** Tüm stok kartları: ürün bilgisi + fiyatlar (tek, kilitsiz okuma). */
export function urunleriCek(): Promise<VegaUrun[]> {
  const s = sema.stok
  return vegaSorgu<VegaUrun>(`
    SELECT
      ${kolon('s', s.id, 'id')},
      ${kolon('s', s.kod, 'kod')},
      ${kolon('s', s.ad, 'ad')},
      ${kolon('s', s.barkod, 'barkod')},
      ${kolon('s', s.marka, 'marka')},
      ${kolon('s', s.kategori, 'kategori')},
      ${kolon('s', s.olcu, 'olcu')},
      ${kolon('s', s.raf, 'raf')},
      ${kolon('s', s.kdv, 'kdv')},
      ${kolon('s', s.satisFiyati, 'satisFiyati')},
      ${kolon('s', s.alisFiyati, 'alisFiyati')},
      ${kolon('s', s.kritikEsik, 'kritikEsik')}
    FROM ${ad(s.tablo)} s WITH (NOLOCK)`)
}

/**
 * Depo bakiyeleri = girişler − çıkışlar.
 * `stokIdleri` verilirse yalnızca o kartlar hesaplanır (hızlı tur);
 * verilmezse tüm kartlar (tam tur). Hareketi olmayan kart sonuçta yer almaz.
 */
export async function stoklariCek(stokIdleri?: number[]): Promise<VegaStok[]> {
  const h = sema.hareket
  const govde = (filtre: string) => `
    SELECT h.${ad(h.stokId)} AS id,
           SUM(CASE WHEN ${h.girisKosulu} THEN h.${ad(h.miktar)} ELSE -h.${ad(h.miktar)} END) AS stok
    FROM ${ad(h.tablo)} h WITH (NOLOCK)
    ${filtre}
    GROUP BY h.${ad(h.stokId)}`

  if (!stokIdleri) return vegaSorgu<VegaStok>(govde(''))

  // Kimlikler tam sayıya zorlanıp parça parça gönderilir (eski SQL Server'larda da çalışır)
  const idler = [...new Set(stokIdleri.map(Number).filter(Number.isInteger))]
  const sonuc: VegaStok[] = []
  for (let i = 0; i < idler.length; i += 500) {
    const parca = idler.slice(i, i + 500).join(',')
    sonuc.push(...(await vegaSorgu<VegaStok>(govde(`WHERE h.${ad(h.stokId)} IN (${parca})`))))
  }
  return sonuc
}

/** Hareket tablosundaki en büyük kimlik (tablo boşsa 0). */
export async function sonHareketId(): Promise<number> {
  const h = sema.hareket
  const [satir] = await vegaSorgu<{ son: number | null }>(
    `SELECT MAX(h.${ad(h.id)}) AS son FROM ${ad(h.tablo)} h WITH (NOLOCK)`,
  )
  return satir?.son ?? 0
}

/** Verilen kimlikten sonra hareket görmüş stok kartları — "sadece değişenler". */
export async function degisenStokIdleri(sonId: number): Promise<number[]> {
  const h = sema.hareket
  const satirlar = await vegaSorgu<{ id: number }>(
    `SELECT DISTINCT h.${ad(h.stokId)} AS id
     FROM ${ad(h.tablo)} h WITH (NOLOCK)
     WHERE h.${ad(h.id)} > @sonId`,
    { sonId },
  )
  return satirlar.map((s) => s.id)
}
