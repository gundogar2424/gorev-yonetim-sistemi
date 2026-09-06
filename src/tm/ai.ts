// Internetten bulunan bir tarifi Claude ile TM7 (Thermomix) adimlarina uyarlar.
// Tarayicidan dogrudan cagrilir; kullanici KENDI API anahtarini girer ve
// anahtar yalnizca cihazda (IndexedDB) saklanir.
//
// NOT: SDK yalnizca cagri aninda (dinamik import) yuklenir; boylece sayfa
// acilisinda SDK yuzunden bir sorun olsa bile uygulama yine de acilir.
import type { TmConversion } from './types'
import { normalizeConversion } from './lib/recipeIO'

export const DEFAULT_MODEL = 'claude-opus-5'

// Dusunme derinligi: uyarlama isi orta seviye akil ister ("bu adim kac devir,
// kac saniye"), ama arastirma degil. 'medium' yeterli ve ucuz.
function supportsEffort(model?: string): boolean {
  const m = (model || '').toLowerCase()
  if (m.includes('haiku')) return false
  if (m.includes('sonnet-4-5')) return false
  if (m.includes('fable') || m.includes('mythos')) return true
  if (m.includes('opus-5') || m.includes('opus-4-8') || m.includes('opus-4-7') || m.includes('opus-4-6')) return true
  if (m.includes('sonnet-5') || m.includes('sonnet-4-6')) return true
  return false
}

let lastKeyInfo = ''

async function createClient(apiKey: string) {
  lastKeyInfo = `${apiKey.length} karakter, sonu …${apiKey.slice(-4)}`
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

// API hatalarini anlasilir Turkce mesaja cevirir.
function friendlyError(err: unknown): Error {
  const e = err as { status?: number; name?: string; message?: string }
  const status = typeof e?.status === 'number' ? e.status : undefined
  const detail = e?.message ?? ''
  if (status === 401)
    return new Error(
      `API anahtarı kabul edilmedi (401).\nSunucu: ${detail || 'metin yok'}\nGönderilen anahtar: ${
        lastKeyInfo || 'bilinmiyor'
      }\nAyarlar bölümünden anahtarı kontrol edin.`
    )
  if (status === 403) return new Error('API anahtarınızın bu modele erişim izni yok ya da bakiyeniz yetersiz.')
  if (status === 429) return new Error('Çok fazla istek gönderildi. Lütfen birazdan tekrar deneyin.')
  if (status === 404)
    return new Error(`Model bulunamadı. Ayarlar'dan model adını kontrol edin (örn. ${DEFAULT_MODEL}). Ayrıntı: ${detail}`)
  if (status === 400) return new Error(`Geçersiz istek (400): ${detail}`)
  if (
    e?.name === 'APIConnectionError' ||
    e?.name === 'APIConnectionTimeoutError' ||
    detail.toLowerCase().includes('connection') ||
    detail.toLowerCase().includes('network') ||
    detail.toLowerCase().includes('fetch failed')
  ) {
    return new Error('İnternet bağlantısı kurulamadı. Bağlantını kontrol edip tekrar dene. 📶')
  }
  if (status) return new Error(`Uyarlama başarısız (${status}): ${detail}`)
  return new Error(`Beklenmeyen bir hata oluştu: ${detail || String(err)}`)
}

// Yapisal cikti semasi. Anthropic'in json_schema bicimi KATIDIR: her alan
// `required` icinde olmali ve fazladan alan olmamali. "Yok" durumlari bos
// dize / 0 ile belirtilir.
const STEP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    ingredients: { type: 'string' },
    seconds: { type: 'integer' },
    speed: { type: 'string', enum: ['', 'yumusak', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'turbo'] },
    reverse: { type: 'boolean' },
    temp: { type: 'string' },
    mode: {
      type: 'string',
      enum: ['', 'sote', 'yavas', 'sousvide', 'ferment', 'hamur', 'pirinc', 'blender', 'tartim', 'buhar', 'temizlik']
    },
    tip: { type: 'string' }
  },
  required: ['text', 'ingredients', 'seconds', 'speed', 'reverse', 'temp', 'mode', 'tip']
} as const

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    category: { type: 'string' },
    servings: { type: 'integer' },
    minutes: { type: 'integer' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: STEP_SCHEMA },
    notes: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } }
  },
  required: ['title', 'category', 'servings', 'minutes', 'ingredients', 'steps', 'notes', 'warnings']
} as const

// TM7'nin kurallarini modele ogreten sistem metni. Uzun oldugu icin istem
// onbellegine alinir: ayni metin her cagrida bastan faturalanmaz.
const SYSTEM = `Sen bir Thermomix TM7 tarif uyarlayıcısısın. Sana internetten alınmış, NORMAL (tencere/ocak) usulü yazılmış bir yemek tarifi verilir. Görevin: bu tarifi Thermomix TM7 cihazında adım adım yapılabilecek hale getirmek.

CİHAZIN DİLİ (bunun dışına çıkma):
- Devir (speed): yumuşak karıştırma (kaşık), 0.5, 1-10 arası, Turbo. Alan adı "speed"; değerler: "", "yumusak", "0.5", "1".."10", "turbo". Bıçak dönmeyen adımda "" bırak.
- Sıcaklık: "" (ısıtma yok), "37".."160" (derece, sayı olarak yazılır) veya "varoma" (buhar kademesi). Alan adı "temp".
- Süre: saniye cinsinden tam sayı ("seconds"). Süre verilmeyen/elle yapılan adımda 0.
- Ters yön ("reverse"): malzeme parçalanmadan karışsın diye bıçağın tersine dönmesi. Etli/sebzeli sulu yemeklerde pişirme adımlarında true olmalı.
- Özel mod ("mode"): "" normal, "sote" kavurma, "hamur" yoğurma, "buhar" Varoma'da buharda pişirme, "yavas" yavaş pişirme, "sousvide", "ferment" mayalama, "pirinc", "blender", "tartim", "temizlik".

UYARLAMA KURALLARI:
1. Ocakta yapılan işi cihazın karşılığına çevir: soğan doğrama → 5 sn / devir 5; kavurma → 3-5 dk / 120 °C / devir 1 (mode "sote"); sulu pişirme → 100 °C / devir 1 / ters yön; pürelemek → 30-60 sn / devir 8-10 (kademeli artır); hamur → 2 dk / mode "hamur"; süt/muhallebi → 90 °C / devir 3-4, sürekli karıştırma.
2. Sırayı cihaza göre yeniden düzenle: önce kuru/sert malzemeleri doğra, sonra yağ+soğanı kavur, sonra sıvıları ekle. Kabı boşuna yıkatma — mümkünse tek kapta ilerle, gerekiyorsa "kabı boşalt/durula" diye ayrı adım yaz.
3. Her adımın "text" alanı KISA ve emir kipinde olsun ("Soğanı kaba al ve doğra."). Cihaz ayarlarını text içine YAZMA; onlar seconds/speed/temp alanlarına gider.
4. "ingredients" alanına o adımda kaba giren malzemeleri miktarıyla yaz ("1 soğan, 2 yemek kaşığı zeytinyağı"). Kaba bir şey girmiyorsa boş bırak.
5. Sıcak sıvıyı yüksek devirde çekerken, kap dolulukta (2 litre çizgisi) veya Varoma sıcaklığında dikkat gerekiyorsa "warnings" listesine kısa bir uyarı ekle. Uydurma uyarı ekleme, gerçekten gerekliyse ekle.
6. Tarifte cihazın yapamayacağı bir iş varsa (fırında pişirme, tavada kızartma, mangal) o adımı cihazın DIŞINDA yapılacak şekilde yaz ve "tip" alanında belirt (örn. "Bu adım fırında yapılır, cihaz kullanılmaz.").
7. Miktarları ve malzemeleri DEĞİŞTİRME; sadece yöntemi cihaza uyarla. Tarifte olmayan malzeme ekleme.
8. "ingredients" (ana liste) tarifin tüm malzemelerini miktarlarıyla içersin. "category" için şunlardan birini seç: Çorba, Ana Yemek, Meze & Salata, Sos, Hamur İşi, Tatlı, İçecek, Kahvaltı, Diğer.
9. "notes" alanına en fazla iki cümlelik pratik bir not yaz (saklama, servis, kıvam). Gereksizse boş bırak.
10. Her şeyi TÜRKÇE yaz.`

interface ConvertOpts {
  apiKey: string
  model?: string
  text?: string // Yapistirilan tarif metni
  image?: { base64: string; mediaType: string } // Ekran goruntusu / fotograf
  note?: string // Kullanicinin ek istegi ("4 kisilik yap", "sarimsak koyma")
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

// Tarifi TM7 adimlarina uyarlar. Kaydetmeden once onizlenmesi icin dondurur.
export async function convertRecipe(opts: ConvertOpts): Promise<TmConversion> {
  const { apiKey, model = DEFAULT_MODEL, text, image, note } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden Claude API anahtarınızı girin.')
  if (!text?.trim() && !image) throw new Error('Uyarlanacak bir tarif yapıştır ya da fotoğrafını seç.')

  const content: ContentBlock[] = []
  if (image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } })
  }
  content.push({
    type: 'text',
    text:
      (image ? 'Bu görseldeki tarifi' : 'Aşağıdaki tarifi') +
      ' Thermomix TM7 için uyarla.' +
      (note?.trim() ? `\n\nEK İSTEĞİM: ${note.trim()}` : '') +
      (text?.trim() ? `\n\nTARİF:\n${text.trim()}` : '')
  })

  const client = await createClient(apiKey)
  try {
    const params: Record<string, unknown> = {
      model,
      max_tokens: 6000,
      // Sistem metni uzun ve her cagrida ayni: onbellege al (girdi bedelinin ~%10'u).
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } }
    }
    if (supportsEffort(model)) params.output_config = { ...(params.output_config as object), effort: 'medium' }

    const response = await client.messages.create(params as never)
    const res = response as unknown as {
      stop_reason?: string
      content: { type: string; text?: string }[]
    }
    if (res.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    if (res.stop_reason === 'max_tokens')
      throw new Error('Tarif çok uzun geldi, yanıt yarıda kesildi. Tarifi kısaltıp tekrar dene.')

    const raw = res.content
      .map((b) => (b.type === 'text' ? (b.text ?? '') : ''))
      .join('')
      .trim()
    if (!raw) throw new Error('Modelden boş yanıt geldi. Lütfen tekrar deneyin.')
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let parsed: Partial<TmConversion>
    try {
      parsed = JSON.parse(cleaned) as Partial<TmConversion>
    } catch {
      throw new Error(`Yapay zeka yanıtı çözümlenemedi. Gelen yanıt: "${cleaned.slice(0, 120)}…"`)
    }
    return normalizeConversion(parsed)
  } catch (err) {
    throw friendlyError(err)
  }
}

// Ayarlardaki "Anahtarı test et" dugmesi icin kucuk bir cagri.
export async function testApiKey(apiKey: string, model = DEFAULT_MODEL): Promise<string> {
  if (!apiKey.trim()) throw new Error('Önce anahtarı gir.')
  const client = await createClient(apiKey.trim())
  try {
    const r = (await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Sadece "tamam" yaz.' }]
    } as never)) as unknown as { content: { type: string; text?: string }[] }
    const t = r.content.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('').trim()
    return t || 'Bağlantı kuruldu.'
  } catch (err) {
    throw friendlyError(err)
  }
}
