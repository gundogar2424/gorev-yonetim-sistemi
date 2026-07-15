// Claude API ile firma sitesi metninden, PDF katalogdan veya fotoğraftan
// ürün listesi çıkarma. Tarayıcıdan doğrudan çağrılır (kullanıcı kendi API
// anahtarını Ayarlar'da verir). SDK yalnızca çağrı anında (lazy) yüklenir.
import type { ExtractedProduct } from './types'

export const DEFAULT_MODEL = 'claude-opus-4-8'
// Ürün çıkarma basit bir iş; varsayılan olarak UCUZ/HIZLI modeli kullanırız
// (çok sayfalı geniş taramada maliyeti kat kat düşürür). Kullanıcı isterse
// Ayarlar'daki modeli geçebilir.
export const EXTRACT_MODEL = 'claude-haiku-4-5-20251001'

async function createClient(apiKey: string) {
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl)
  if (!m) return null
  return { mediaType: m[1], base64: m[2] }
}

// Modelin dolduracağı yapılandırılmış çıktı (JSON Schema). Kök nesne olmalı.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          company: { type: 'string' },
          category: { type: 'string' },
          code: { type: 'string' },
          salePrice: { type: 'number' },
          description: { type: 'string' }
        },
        required: ['name', 'company', 'category', 'code', 'salePrice', 'description']
      }
    }
  },
  required: ['products']
} as const

const SYSTEM = `Sen bir ürün/katalog okuma asistanısın. Verilen içerikten (firma web sitesi metni, PDF katalog ya da fotoğraf) SATILAN ÜRÜNLERİ çıkarırsın.
Kurallar:
- Her ürün için: name (ürün adı, zorunlu), company (marka/firma; belliyse), category (kategori; örn. Kılıf, Kablo, Kulaklık), code (ürün/stok kodu ya da barkod; varsa), salePrice (fiyat; sayı, para birimi olmadan; yoksa 0), description (kısa açıklama; yoksa "").
- Bilinmeyen metin alanları için boş string "", bilinmeyen fiyat için 0 kullan. ASLA uydurma; yalnızca içerikte geçen bilgiyi yaz.
- Menü, iletişim, hakkımızda, çerez, kampanya sloganı gibi ÜRÜN OLMAYAN satırları ATLA.
- Aynı ürünü tekrar yazma.
- Türkçe karakterleri koru. Yanıtı SADECE şemaya uygun ver.`

interface ExtractOptions {
  apiKey: string
  model?: string
  text?: string // site/pasted metin
  pdfDataUrl?: string // application/pdf data URL
  imageDataUrl?: string // görsel data URL
}

// İçerikten ürün listesi çıkarır. En az biri (text/pdf/image) verilmelidir.
export async function extractProducts(opts: ExtractOptions): Promise<ExtractedProduct[]> {
  const { apiKey, model = EXTRACT_MODEL, text, pdfDataUrl, imageDataUrl } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!text && !pdfDataUrl && !imageDataUrl) throw new Error('Okunacak bir içerik yok.')

  const content: unknown[] = []

  if (pdfDataUrl) {
    const doc = splitDataUrl(pdfDataUrl)
    if (!doc) throw new Error('PDF okunamadı.')
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 } })
  }
  if (imageDataUrl) {
    const img = splitDataUrl(imageDataUrl)
    if (!img) throw new Error('Fotoğraf okunamadı.')
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } })
  }
  content.push({
    type: 'text',
    text:
      (text ? `Aşağıdaki içerikten satılan ürünleri çıkar:\n\n${text}` : 'Yüklenen belgedeki/fotoğraftaki satılan ürünleri çıkar.') +
      '\n\nTüm ürünleri şemaya uygun listele.'
  })

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: content as never }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } }
    } as never)

    const r = response as { stop_reason?: string; content: { type: string; text?: string }[] }
    if (r.stop_reason === 'refusal') throw new Error('İstek güvenlik nedeniyle reddedildi.')
    if (r.stop_reason === 'max_tokens') {
      throw new Error('Katalog çok uzun, yanıt kesildi. Daha küçük bir bölüm/parça deneyin.')
    }
    const raw = r.content
      .map((b) => (b.type === 'text' ? b.text || '' : ''))
      .join('')
      .trim()
    if (!raw) throw new Error('Modelden boş yanıt geldi.')
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { products?: ExtractedProduct[] }
    const list = Array.isArray(parsed.products) ? parsed.products : []
    // Boş alanları temizle, seçili işaretle
    return list
      .filter((p) => p.name?.trim())
      .map((p) => ({
        name: p.name.trim(),
        company: p.company?.trim() || undefined,
        category: p.category?.trim() || undefined,
        code: p.code?.trim() || undefined,
        salePrice: p.salePrice && p.salePrice > 0 ? p.salePrice : undefined,
        description: p.description?.trim() || undefined,
        _selected: true
      }))
  } catch (err) {
    throw friendlyError(err)
  }
}

// Büyük metni parça parça okur, sonuçları birleştirir ve tekrarları eler.
// onProgress(current, total) ile ilerleme bildirir (örn. "Bölüm 2/6").
export async function extractProductsFromChunks(opts: {
  apiKey: string
  model?: string
  chunks: string[]
  onProgress?: (current: number, total: number) => void
}): Promise<ExtractedProduct[]> {
  const { apiKey, model, chunks, onProgress } = opts
  const seen = new Set<string>()
  const all: ExtractedProduct[] = []
  const key = (p: ExtractedProduct) =>
    `${(p.name || '').trim().toLocaleLowerCase('tr-TR')}|${(p.code || '').trim().toLocaleLowerCase('tr-TR')}`

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length)
    let list: ExtractedProduct[] = []
    try {
      list = await extractProducts({ apiKey, model, text: chunks[i] })
    } catch (err) {
      // Bir parça başarısız olsa da diğerlerine devam et; ama yetki/kota
      // hatasında baştan durdur (hepsi aynı sebeple düşer).
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 429) throw err
      continue
    }
    for (const p of list) {
      const k = key(p)
      if (seen.has(k)) continue
      seen.add(k)
      all.push(p)
    }
  }
  return all
}

function friendlyError(err: unknown): Error {
  const status = (err as { status?: number })?.status
  if (status === 401) return new Error('API anahtarı geçersiz. Ayarlar’dan kontrol edin.')
  if (status === 429) return new Error('Çok fazla istek ya da kota doldu. Biraz sonra tekrar deneyin.')
  if (status === 400) return new Error('İstek reddedildi (içerik çok büyük olabilir). Daha küçük bir parça deneyin.')
  const msg = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.'
  return new Error(msg)
}
