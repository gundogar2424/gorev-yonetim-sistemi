// Barkod okuma (fotograftan) + Open Food Facts ile urun/besin sorgulama.
// Open Food Facts ucretsiz ve acik bir veritabani (Avrupa + Turkiye dahil);
// API anahtari gerekmez. Token harcamaz.
// NOT: ZXing kutuphanesi buyuk; yalnizca barkod okunurken (lazy) yuklenir.

import { dietDb } from '../db'

export interface ProductInfo {
  barcode: string
  name: string
  per100: { kcal: number; protein: number; carb: number; fat: number }
}

// Hafizadaki (elle girilmis) urunu getir
export async function getSavedProduct(barcode: string): Promise<ProductInfo | null> {
  const r = await dietDb.products.where('barcode').equals(barcode.trim()).first()
  if (!r) return null
  return { barcode: r.barcode, name: r.name, per100: { kcal: r.kcal, protein: r.protein, carb: r.carb, fat: r.fat } }
}

// Urunu hafizaya kaydet (ayni barkod varsa gunceller)
export async function saveProduct(p: ProductInfo): Promise<void> {
  const row = {
    barcode: p.barcode.trim(),
    name: p.name,
    kcal: p.per100.kcal,
    protein: p.per100.protein,
    carb: p.per100.carb,
    fat: p.per100.fat,
    createdAt: Date.now()
  }
  const existing = await dietDb.products.where('barcode').equals(row.barcode).first()
  if (existing?.id != null) await dietDb.products.update(existing.id, row)
  else await dietDb.products.add(row)
}

// Bir fotograftan (data URL) barkod numarasini okur; bulamazsa null
export async function decodeBarcodeFromImage(dataUrl: string): Promise<string | null> {
  try {
    const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library')
    // Daha iyi okuma: "daha çok uğraş" + market barkodu formatları
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39
    ])
    const reader = new BrowserMultiFormatReader(hints)
    const result = await reader.decodeFromImageUrl(dataUrl)
    return result?.getText() ?? null
  } catch {
    return null // barkod okunamadi
  }
}

// APK'da Google'in native barkod tarayicisi (ML Kit). Web kamerasindan
// cok daha guvenilir okur. Native degilse null doner (web tarayiciya dusulur).
export async function nativeScan(): Promise<string | null> {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return null
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
  const { barcodes } = await BarcodeScanner.scan()
  return barcodes?.[0]?.rawValue ?? null
}

export interface ScannerControls {
  stop: () => void
}

// Canli kamera ile barkod tarama. videoEl'e arka kamerayi baglar; barkod
// okununca onResult cagrilir. Durdurmak icin donen stop() kullanilir.
export async function startLiveScan(
  videoEl: HTMLVideoElement,
  onResult: (code: string) => void,
  onError: (msg: string) => void
): Promise<ScannerControls> {
  try {
    const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library')
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128
    ])
    const reader = new BrowserMultiFormatReader(hints)
    let done = false
    const stop = () => {
      done = true
      try {
        reader.reset()
      } catch {
        // yok say
      }
    }
    await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoEl, (result) => {
      if (result && !done) {
        const text = result.getText()
        stop()
        onResult(text)
      }
    })
    return { stop }
  } catch {
    onError('Kamera açılamadı. İzin vermen gerekebilir. Fotoğraf çekerek ya da numarayı yazarak da okutabilirsin.')
    return { stop: () => {} }
  }
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? Math.round((n as number) * 10) / 10 : 0
}

// Barkodu Open Food Facts'te ara; bulunamazsa null
export async function lookupProduct(barcode: string): Promise<ProductInfo | null> {
  const code = barcode.trim()
  if (!/^\d{6,14}$/.test(code)) throw new Error('Geçersiz barkod (sadece rakam, 6-14 hane).')
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Veritabanına ulaşılamadı. İnternet bağlantını kontrol et.')
  const j = await res.json()
  if (j.status !== 1 || !j.product) return null
  const p = j.product
  const n = p.nutriments || {}
  const name = [p.brands, p.product_name].filter(Boolean).join(' — ').trim() || 'İsimsiz ürün'
  return {
    barcode: code,
    name,
    per100: {
      kcal: num(n['energy-kcal_100g']),
      protein: num(n['proteins_100g']),
      carb: num(n['carbohydrates_100g']),
      fat: num(n['fat_100g'])
    }
  }
}

// Belli gram icin besin degerlerini hesaplar (100 g uzerinden orantilar)
export function forGrams(p: ProductInfo, grams: number) {
  const f = grams / 100
  return {
    kcal: Math.round(p.per100.kcal * f),
    protein: Math.round(p.per100.protein * f),
    carb: Math.round(p.per100.carb * f),
    fat: Math.round(p.per100.fat * f)
  }
}
