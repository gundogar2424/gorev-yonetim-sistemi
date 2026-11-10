import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { config } from '../config'
import { gorselSurumArtir } from '../yerel/db'

/**
 * Ürün görselleri: yüklenen her dosya (JPG/PNG/HEIC/WebP...) sunucuda iki
 * WebP boyutuna çevrilir. Orijinal dosya saklanmaz.
 *   kart  : katalog ızgarası için küçük ve hafif
 *   buyuk : detay görünümü ve PDF teklif için yüksek çözünürlük
 */
export const BOYUTLAR = {
  kart: { kenar: 480, kalite: 78 },
  buyuk: { kenar: 1600, kalite: 84 },
} as const
export type Boyut = keyof typeof BOYUTLAR

mkdirSync(config.gorselKlasor, { recursive: true })

export const gorselYolu = (urunId: number, boyut: Boyut): string => join(config.gorselKlasor, `${urunId}-${boyut}.webp`)

export async function gorselKaydet(urunId: number, dosya: Buffer): Promise<number> {
  for (const [boyut, { kenar, kalite }] of Object.entries(BOYUTLAR)) {
    await sharp(dosya)
      .rotate() // telefon fotoğraflarındaki EXIF yönünü uygular
      .resize({ width: kenar, height: kenar, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: kalite })
      .toFile(gorselYolu(urunId, boyut as Boyut))
  }
  return gorselSurumArtir(urunId)
}
