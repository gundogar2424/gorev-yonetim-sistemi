import { config } from '../config'
import { degisenStokIdleri, sonHareketId, stoklariCek, urunleriCek } from '../vega/sorgular'
import { metaOku, metaYaz, stoklariUygula, urunleriUygula } from '../yerel/db'

/**
 * Hafif eşitleme servisi (Vega → yerel önbellek, tek yönlü).
 *
 *  Hızlı tur (varsayılan 30 sn): hareket tablosunda son gördüğümüz kimlikten
 *    sonra satır var mı? Varsa YALNIZCA o stok kartlarının bakiyesi yeniden
 *    hesaplanır. Değişiklik yoksa Vega'ya giden tek şey bir MAX() sorgusudur.
 *  Tam tur (varsayılan 15 dk): tüm kartlar + tüm bakiyeler. Fiyat/isim
 *    değişikliklerini ve eski hareketlerde yapılan düzeltme/silmeleri yakalar.
 */

export const durum = {
  sonHizliTur: null as string | null,
  sonTamTur: null as string | null,
  sonHata: null as string | null,
  calisiyor: false,
}

type Gunluk = { info: (m: string) => void; error: (m: string) => void }

export async function tamTur(log: Gunluk): Promise<void> {
  // Sınırı ÖNCE oku: tur sürerken gelen hareketler bir sonraki hızlı turda yeniden ele alınır
  const sinir = await sonHareketId()
  const urun = urunleriUygula(await urunleriCek())
  const stok = stoklariUygula(await stoklariCek())
  metaYaz('sonHareketId', sinir)
  durum.sonTamTur = new Date().toISOString()
  log.info(`Tam tur: ${urun.degisen} kart güncellendi, ${urun.silinen} silindi, ${stok} bakiye değişti`)
}

export async function hizliTur(log: Gunluk): Promise<void> {
  const onceki = Number(metaOku('sonHareketId') ?? 0)
  const sinir = await sonHareketId()
  if (sinir > onceki) {
    const idler = await degisenStokIdleri(onceki)
    const degisen = stoklariUygula(await stoklariCek(idler), idler)
    metaYaz('sonHareketId', sinir)
    log.info(`Hızlı tur: ${idler.length} kart hareket gördü, ${degisen} bakiye değişti`)
  } else if (sinir < onceki) {
    // Kimlik geriledi (dönem devri / tablo yenilendi): güvenli taraf tam tur
    await tamTur(log)
  }
  durum.sonHizliTur = new Date().toISOString()
}

export function esitlemeyiBaslat(log: Gunluk): () => void {
  let durdu = false
  let zamanlayici: NodeJS.Timeout | undefined
  let sonTam = 0
  let ardArdaHata = 0

  const dongu = async () => {
    durum.calisiyor = true
    try {
      // İlk çalıştırma ya da tam tur zamanı geldiyse tam tur; değilse hızlı tur
      if (!metaOku('sonHareketId') || Date.now() - sonTam >= config.tamTurDk * 60_000) {
        await tamTur(log)
        sonTam = Date.now()
      } else {
        await hizliTur(log)
      }
      durum.sonHata = null
      ardArdaHata = 0
    } catch (e) {
      durum.sonHata = e instanceof Error ? e.message : String(e)
      ardArdaHata++
      log.error(`Eşitleme hatası: ${durum.sonHata}`)
    } finally {
      durum.calisiyor = false
      // Turlar asla üst üste binmez; hata sürdükçe aralık 5 dakikaya kadar açılır
      const bekle = Math.min(config.hizliTurSn * 2 ** Math.min(ardArdaHata, 4), 300)
      if (!durdu) zamanlayici = setTimeout(dongu, bekle * 1000)
    }
  }
  void dongu()
  return () => {
    durdu = true
    clearTimeout(zamanlayici)
  }
}
