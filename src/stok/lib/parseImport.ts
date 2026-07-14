// Excel/CSV'den kopyalanan tabloyu ya da serbest listeyi ürünlere çevirir.
// Başlık satırını tanır; yoksa konumdan akıllı tahmin yapar. API anahtarı GEREKMEZ.
import type { ExtractedProduct } from '../types'

type Field = 'name' | 'company' | 'category' | 'code' | 'salePrice' | 'buyPrice' | 'qty' | 'unit'

const HEADER_MAP: Record<string, Field> = {
  urun: 'name',
  'urun adi': 'name',
  'urun ismi': 'name',
  ad: 'name',
  adi: 'name',
  isim: 'name',
  ürün: 'name',
  'ürün adı': 'name',
  malzeme: 'name',
  firma: 'company',
  marka: 'company',
  tedarikci: 'company',
  tedarikçi: 'company',
  kategori: 'category',
  grup: 'category',
  tur: 'category',
  tür: 'category',
  kod: 'code',
  'urun kodu': 'code',
  'ürün kodu': 'code',
  'stok kodu': 'code',
  barkod: 'code',
  sku: 'code',
  fiyat: 'salePrice',
  'satis fiyati': 'salePrice',
  'satış fiyatı': 'salePrice',
  'satis': 'salePrice',
  'liste fiyati': 'salePrice',
  'alis fiyati': 'buyPrice',
  'alış fiyatı': 'buyPrice',
  'alis': 'buyPrice',
  maliyet: 'buyPrice',
  adet: 'qty',
  miktar: 'qty',
  stok: 'qty',
  'stok adedi': 'qty',
  birim: 'unit'
}

function normalize(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
}

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t'
  if (line.includes(';')) return ';'
  if (line.includes(',') && line.split(',').length > 1) return ','
  return '\t'
}

function toNumber(v: string): number | undefined {
  if (!v) return undefined
  // "1.250,00 ₺" → 1250.00 ; "180" → 180
  let t = v.replace(/[^\d.,-]/g, '').trim()
  if (!t) return undefined
  if (t.includes(',') && t.includes('.')) {
    // 1.250,00 (TR) → binlik nokta, ondalık virgül
    t = t.replace(/\./g, '').replace(',', '.')
  } else if (t.includes(',')) {
    t = t.replace(',', '.')
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function looksNumeric(v: string): boolean {
  return /^\s*[\d.,]+\s*(₺|tl|try)?\s*$/i.test(v) && /\d/.test(v)
}

export function parseProductPaste(text: string): ExtractedProduct[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  const delim = detectDelimiter(lines[0])
  const matrix = lines.map((l) => l.split(delim).map((c) => c.trim()))

  // Başlık satırı var mı?
  const first = matrix[0]
  const known = first.filter((c) => HEADER_MAP[normalize(c)]).length
  const hasHeader = known >= 2 || (known >= 1 && first.length <= 2)

  let columns: (Field | null)[]
  let dataRows: string[][]

  if (hasHeader) {
    columns = first.map((c) => HEADER_MAP[normalize(c)] ?? null)
    dataRows = matrix.slice(1)
  } else {
    columns = guessColumns(matrix)
    dataRows = matrix
  }

  const out: ExtractedProduct[] = []
  for (const cells of dataRows) {
    const p: ExtractedProduct = { name: '', _selected: true }
    cells.forEach((value, i) => {
      const f = columns[i]
      if (!f || !value) return
      switch (f) {
        case 'name':
          p.name = value
          break
        case 'company':
          p.company = value
          break
        case 'category':
          p.category = value
          break
        case 'code':
          p.code = value
          break
        case 'unit':
          p.unit = value
          break
        case 'salePrice':
          p.salePrice = toNumber(value)
          break
        case 'buyPrice':
          p.buyPrice = toNumber(value)
          break
        case 'qty':
          p.qty = toNumber(value)
          break
      }
    })
    // Tek sütunlu serbest liste: hücre = ürün adı
    if (!p.name && cells.length === 1 && cells[0]) p.name = cells[0]
    if (p.name.trim()) out.push(p)
  }
  return out
}

// Başlıksız veride sütunları içerikten tahmin et
function guessColumns(matrix: string[][]): (Field | null)[] {
  const colCount = Math.max(...matrix.map((r) => r.length))
  const cols: (Field | null)[] = new Array(colCount).fill(null)
  if (colCount === 1) {
    cols[0] = 'name'
    return cols
  }
  const sample = (c: number) => matrix.slice(0, 8).map((r) => r[c] ?? '').filter(Boolean)

  // Sayısal sütunları fiyat/adet olarak işaretle; ilk metin sütununu ad yap
  let nameAssigned = false
  let priceAssigned = false
  for (let c = 0; c < colCount; c++) {
    const s = sample(c)
    if (s.length === 0) continue
    const numericRatio = s.filter(looksNumeric).length / s.length
    if (numericRatio >= 0.6) {
      // İlk sayısal → fiyat, sonraki → adet
      if (!priceAssigned) {
        cols[c] = 'salePrice'
        priceAssigned = true
      } else {
        cols[c] = 'qty'
      }
    } else if (!nameAssigned) {
      cols[c] = 'name'
      nameAssigned = true
    } else {
      // İkinci metin sütunu genelde firma/kategori
      cols[c] = 'company'
    }
  }
  if (!nameAssigned) cols[0] = 'name'
  return cols
}
