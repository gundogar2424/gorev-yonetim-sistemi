// Claude API ile fotograftan yemek tanima ve motivasyon uretimi.
// Tarayicidan dogrudan cagrilir (kullanici kendi API anahtarini saglar).
// NOT: SDK yalnizca cagri aninda (dinamik import) yuklenir; boylece sayfa
// acilisinda SDK yuzunden bir hata olsa bile uygulama yine de acilir.
import type { FoodAnalysis } from './types'

export const DEFAULT_MODEL = 'claude-opus-4-8'

// SDK'yi geç (lazy) yukle ve istemciyi olustur
async function createClient(apiKey: string) {
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

// Yapay zekanin dolduracagi yapilandirilmis cikti semasi (JSON Schema).
// Tum alanlar zorunlu; ek alan yok (structured outputs gereksinimi).
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    foodFound: { type: 'boolean' },
    foodName: { type: 'string' },
    healthy: { type: 'boolean' },
    riskLevel: { type: 'string', enum: ['düşük', 'orta', 'yüksek'] },
    estimatedCalories: { type: 'integer' },
    harms: { type: 'array', items: { type: 'string' } },
    motivations: { type: 'array', items: { type: 'string' } },
    healthierAlternative: { type: 'string' },
    verdict: { type: 'string' },
    compliancePercent: { type: 'integer' },
    complianceNote: { type: 'string' }
  },
  required: [
    'foodFound',
    'foodName',
    'healthy',
    'riskLevel',
    'estimatedCalories',
    'harms',
    'motivations',
    'healthierAlternative',
    'verdict',
    'compliancePercent',
    'complianceNote'
  ]
} as const

const SYSTEM_PROMPT = `Sen "Diyet Koçu" adında, diyet yapan insanlara destek olan bir motivasyon koçusun. Kullanıcı bir yemeği YEMEDEN ÖNCE fotoğrafını çekiyor; senin görevin onu diyetini bozmaktan alıkoymak.

Görseldeki yemeği tanı ve şu kurallara göre değerlendir:
- Eğer görselde yemek/içecek yoksa: foodFound=false, foodName="Yemek bulunamadı", diğer alanları nazikçe boş/nötr doldur ve verdict'te net bir fotoğraf çekmesini iste.
- Yemek sağlıksız/yüksek kalorili ise (tatlı, kızartma, fast food, şekerli içecek vb.): Kullanıcıyı SAMİMİ ama KARARLI bir dille uyar. harms alanına bu yemeğin somut zararlarını yaz (kilo, kan şekeri, yağlanma, tokluk hissi vb.). motivations alanına onu vazgeçirecek, içini güçlendirecek motive edici sözler yaz.
- Yemek sağlıklı ise (sebze, ızgara, salata, meyve vb.): healthy=true, riskLevel="düşük" ver ve motivations alanında kullanıcıyı TEBRİK ederek doğru seçim yaptığını söyle.

DİYET LİSTESİ KARŞILAŞTIRMASI:
- Eğer kullanıcı bir DİYET LİSTESİ verdiyse: çektiği yemeğin bu listeye ne kadar uyduğunu yüzde olarak değerlendir. compliancePercent = 0-100 arası bir tam sayı (100 = listeye birebir uygun bir öğün, 0 = listeye tamamen aykırı). complianceNote = neyin uyduğunu/uymadığını TEK kısa cümleyle açıkla (örn. "Listende öğle için ızgara tavuk+salata var, bu uygun" veya "Listende tatlı yok, bu öğün listene aykırı"). Uyum düşükse motivations sözlerini de buna göre kur.
- Eğer diyet listesi VERİLMEDİYSE: compliancePercent = -1 ve complianceNote = "" (boş) bırak.

Üslubun: Türkçe, sıcak, abartısız, suçlayıcı değil GÜÇLENDİRİCİ. Kısa ve vurucu cümleler kur. harms ve motivations için 2-4 madde yeterli. Kaloriyi gram göz kararı tahmin et (porsiyon başına).`

// Bir data URL'i media type + base64 parcalarina ayirir
function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
  if (!m) return null
  return { mediaType: m[1], base64: m[2] }
}

// API hatalarini kullaniciya anlasilir Turkce mesaja cevirir.
// SDK siniflarina (instanceof) bagli kalmadan durum kodu/ada gore calisir.
function friendlyError(err: unknown): Error {
  const e = err as { status?: number; name?: string; message?: string }
  const status = typeof e?.status === 'number' ? e.status : undefined
  const detail = e?.message ?? ''

  if (status === 401) return new Error('API anahtarı geçersiz. Ayarlardan anahtarınızı kontrol edin.')
  if (status === 403) return new Error('API anahtarınızın bu modele erişim izni yok ya da bakiyeniz yetersiz.')
  if (status === 429) return new Error('Çok fazla istek gönderildi. Lütfen birazdan tekrar deneyin.')
  if (status === 404) {
    return new Error(
      `Model bulunamadı. Ayarlar'dan model adını kontrol edin (örn. ${DEFAULT_MODEL} veya claude-sonnet-4-6). Ayrıntı: ${detail}`
    )
  }
  if (status === 400) return new Error(`Geçersiz istek (400): ${detail}`)
  if (e?.name === 'APIConnectionError' || e?.name === 'APIConnectionTimeoutError') {
    return new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.')
  }
  if (status) return new Error(`İnceleme başarısız (${status}): ${detail}`)
  return new Error(err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.')
}

interface AnalyzeOptions {
  apiKey: string
  photoDataUrl: string
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
}

// Fotografi inceler ve yapilandirilmis sonucu dondurur
export async function analyzeFood(opts: AnalyzeOptions): Promise<FoodAnalysis> {
  const { apiKey, photoDataUrl, model = DEFAULT_MODEL, userName, goal, dietPlan } = opts

  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const img = splitDataUrl(photoDataUrl)
  if (!img) throw new Error('Fotoğraf okunamadı, lütfen tekrar deneyin.')

  // Kullanici baglamini (isim/hedef) ek bir not olarak ilet
  const contextLines: string[] = []
  if (userName) contextLines.push(`Kullanıcının adı: ${userName}.`)
  if (goal) contextLines.push(`Diyet hedefi: ${goal}.`)
  const contextText = contextLines.length
    ? `\n\nKullanıcı bağlamı: ${contextLines.join(' ')} Sözlerini bu hedefe göre kişiselleştir.`
    : ''

  // Diyet listesi varsa karsilastirma icin ekle
  const planText = dietPlan?.trim()
    ? `\n\nDİYET LİSTEM (bu yemeği buna göre değerlendir ve uyum yüzdesi ver):\n${dietPlan.trim()}`
    : ''

  const client = await createClient(apiKey)

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType as 'image/jpeg', data: img.base64 }
            },
            {
              type: 'text',
              text: `Bu yemeği yemek üzereyim. Diyetimi bozmadan önce beni değerlendir.${contextText}${planText}`
            }
          ]
        }
      ],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } }
    })

    // Guvenlik geri cevirmesi durumu
    if (response.stop_reason === 'refusal') {
      throw new Error('İstek güvenlik nedeniyle reddedildi. Farklı bir fotoğraf deneyin.')
    }
    // Yanit token sinirina takildiysa JSON yarim kalmis olur
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Yanıt çok uzun oldu ve yarıda kesildi. Lütfen tekrar deneyin.')
    }

    // Tum metin bloklarini birlestir, olasi kod-blogu (```json) sarmalamasini temizle
    const rawText = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    if (!rawText) {
      throw new Error('Modelden boş yanıt geldi. Lütfen tekrar deneyin.')
    }

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    try {
      return JSON.parse(cleaned) as FoodAnalysis
    } catch {
      // Gercek nedeni gormek icin yanitin basini hata mesajina ekle
      const snippet = cleaned.slice(0, 120)
      throw new Error(`Yapay zeka yanıtı çözümlenemedi. Gelen yanıt: "${snippet}…"`)
    }
  } catch (err) {
    throw friendlyError(err)
  }
}

// Diyet listesinin (kagit/PDF) fotografini okuyup duz metne cevirir.
// Boylece kullanici listeyi elle yazmak yerine fotografini cekebilir.
export async function extractDietPlan(opts: {
  apiKey: string
  photoDataUrl: string
  model?: string
}): Promise<string> {
  const { apiKey, photoDataUrl, model = DEFAULT_MODEL } = opts

  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const img = splitDataUrl(photoDataUrl)
  if (!img) throw new Error('Fotoğraf okunamadı, lütfen tekrar deneyin.')

  const client = await createClient(apiKey)

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system:
        'Sen bir diyet listesi okuyucususun. Verilen görseldeki diyet listesini/öğün planını OLDUĞU GİBI, düzenli ve okunaklı bir metne dökersin. Öğünleri (Kahvaltı, Ara Öğün, Öğle, Akşam vb.) başlıklarıyla, maddeler hâlinde yaz. Yorum ekleme, sadece listeyi metne çevir. Görselde diyet listesi yoksa "Listede okunabilir bir diyet planı bulunamadı." yaz.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType as 'image/jpeg', data: img.base64 }
            },
            { type: 'text', text: 'Bu diyet listesini düzenli bir metne çevir.' }
          ]
        }
      ]
    })

    if (response.stop_reason === 'refusal') {
      throw new Error('İstek güvenlik nedeniyle reddedildi. Farklı bir fotoğraf deneyin.')
    }

    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    if (!text) throw new Error('Listeden metin çıkarılamadı. Lütfen daha net bir fotoğraf deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}
