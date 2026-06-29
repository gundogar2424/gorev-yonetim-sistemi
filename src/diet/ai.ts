// Claude API ile fotograftan yemek tanima ve motivasyon uretimi.
// Tarayicidan dogrudan cagrilir (kullanici kendi API anahtarini saglar).
// NOT: SDK yalnizca cagri aninda (dinamik import) yuklenir; boylece sayfa
// acilisinda SDK yuzunden bir hata olsa bile uygulama yine de acilir.
import type { FoodAnalysis, MealAdvice } from './types'

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
    complianceNote: { type: 'string' },
    cravingPortion: { type: 'string' },
    cravingNote: { type: 'string' }
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
    'complianceNote',
    'cravingPortion',
    'cravingNote'
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

KONTROLLÜ KAÇAMAK (çok önemli):
- Yemek sağlıksız/riskli ise, kullanıcıyı tamamen yasaklayıp pişman etmek yerine GERÇEKÇİ ol: bazen canı çok çeker. cravingPortion alanına, diyeti tamamen bozmayacak MAKUL ve ÖLÇÜLEBİLİR bir miktar öner — "şu kadar gram" veya "şu kadar parça/dilim/kare" gibi net olsun (örn. "2 kare bitter çikolata (~20 g)", "yarım dilim (~30 g)", "1 küçük avuç (~15 g)"). Miktar küçük ama tatmin edici olsun.
- cravingNote alanına, o miktarda durması için motive edici, suçlamayan KISA bir söz yaz (örn. "Tadına bak, keyfini çıkar ve orada dur — bu bir kaçamak, teslim olmak değil.").
- Yemek SAĞLIKLI ise ya da görselde yemek yoksa: cravingPortion="" ve cravingNote="" (boş) bırak; sağlıklı yemekte kısıtlama önerme.

Üslubun: Türkçe, sıcak, abartısız, suçlayıcı değil GÜÇLENDİRİCİ. Kısa ve vurucu cümleler kur. harms ve motivations için 2-4 madde yeterli. Kaloriyi gram göz kararı tahmin et (porsiyon başına).`

// Bir data URL'i media type + base64 parcalarina ayirir
function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
  if (!m) return null
  return { mediaType: m[1], base64: m[2] }
}

// Goruntu VEYA PDF data URL'inden uygun mesaj icerik blogu olusturur
function mediaBlock(dataUrl: string): Record<string, unknown> | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  const media = m[1]
  const data = m[2]
  if (media === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
  }
  if (media.startsWith('image/')) {
    return { type: 'image', source: { type: 'base64', media_type: media, data } }
  }
  return null
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
  note?: string // Kullanicinin duzeltmesi/aciklamasi (yemek adi, miktar vb.)
}

// Fotografi inceler ve yapilandirilmis sonucu dondurur
export async function analyzeFood(opts: AnalyzeOptions): Promise<FoodAnalysis> {
  const { apiKey, photoDataUrl, model = DEFAULT_MODEL, userName, goal, dietPlan, note } = opts

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

  // Kullanici duzeltmesi varsa, gorseldeki tahminden ONCE gelir (otorite kullanicidir)
  const noteText = note?.trim()
    ? `\n\nKULLANICININ DÜZELTMESİ (ÇOK ÖNEMLİ — buna KESIN uy): Bu yemek/öğün aslında şudur: "${note.trim()}". foodName alanını ve miktar/kalori tahminini KULLANICININ söylediğine göre belirle; görseldeki görüntüyle çelişse bile kullanıcının beyanını esas al. Belirttiği miktarı (porsiyon/gram) kaloride dikkate al.`
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
              text: `Bu yemeği yemek üzereyim. Diyetimi bozmadan önce beni değerlendir.${contextText}${planText}${noteText}`
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

// SADECE METINDEN degerlendirme (fotograf gondermez -> cok daha az token).
// Kullanici yemegi yanlis tanindiginda "bu aslinda sudur" diye yazinca kullanilir.
export async function analyzeFoodByText(opts: {
  apiKey: string
  note: string
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
}): Promise<FoodAnalysis> {
  const { apiKey, note, model = DEFAULT_MODEL, userName, goal, dietPlan } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!note.trim()) throw new Error('Yemeğin ne olduğunu yaz.')

  const contextLines: string[] = []
  if (userName) contextLines.push(`Kullanıcının adı: ${userName}.`)
  if (goal) contextLines.push(`Diyet hedefi: ${goal}.`)
  const contextText = contextLines.length ? `\n\nKullanıcı bağlamı: ${contextLines.join(' ')}` : ''
  const planText = dietPlan?.trim()
    ? `\n\nDİYET LİSTEM (buna göre değerlendir ve uyum yüzdesi ver):\n${dietPlan.trim()}`
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
          content: `Bu yemeği yemek üzereyim (fotoğraf yok, sana ben tarif ediyorum): "${note.trim()}". foodName ve kalori/miktarı bu tarife göre belirle. Diyetimi bozmadan önce beni değerlendir.${contextText}${planText}`
        }
      ],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } }
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi. Farklı bir açıklama deneyin.')
    if (response.stop_reason === 'max_tokens') throw new Error('Yanıt yarıda kesildi. Lütfen tekrar deneyin.')
    const rawText = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!rawText) throw new Error('Modelden boş yanıt geldi. Lütfen tekrar deneyin.')
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    try {
      return JSON.parse(cleaned) as FoodAnalysis
    } catch {
      throw new Error(`Yapay zeka yanıtı çözümlenemedi. Gelen yanıt: "${cleaned.slice(0, 120)}…"`)
    }
  } catch (err) {
    throw friendlyError(err)
  }
}

// "Ne Yesem?" cikti semasi (gramajli ogun onerileri + makrolar)
const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    foodsFound: { type: 'boolean' },
    foodsDetected: { type: 'array', items: { type: 'string' } },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                grams: { type: 'integer' }
              },
              required: ['name', 'grams']
            }
          },
          calories: { type: 'integer' },
          protein: { type: 'integer' },
          carb: { type: 'integer' },
          fat: { type: 'integer' },
          reason: { type: 'string' }
        },
        required: ['title', 'items', 'calories', 'protein', 'carb', 'fat', 'reason']
      }
    },
    tip: { type: 'string' }
  },
  required: ['foodsFound', 'foodsDetected', 'suggestions', 'tip']
} as const

const MEAL_SYSTEM = `Sen "Diyet Koçu" adında bir beslenme koçusun. Kullanıcı elindeki/mutfağındaki ürünlerin (besinlerin) fotoğrafını çekiyor. Senin görevin bu ürünlerden DİYETİNE UYGUN, gramajlı öğün önerileri sunmak.

Kurallar:
- Görseldeki yenilebilir ürünleri tanı ve foodsDetected dizisine yaz. Görselde tanınabilir besin yoksa foodsFound=false, suggestions=[] ve tip alanında net bir fotoğraf istemesini söyle.
- 2-3 farklı öğün önerisi (suggestions) üret. Mümkün olduğunca SADECE görseldeki ürünleri kullan; gerekirse "yanına" çok temel bir şey (su, baharat) eklenebilir ama esas görseldekiler olsun.
- Her öneri için items dizisinde "şu üründen şu kadar GRAM" şeklinde net porsiyonlar ver (her ürün için grams alanı).
- Her öneri için SADECE kalori değil MAKRO besinleri de hesapla: protein, carb (karbonhidrat), fat (yağ) — hepsi GRAM cinsinden tam sayı. calories = toplam tahmini kalori.
- reason alanında bu önerinin neden iyi olduğunu ve (varsa) diyet listesine/hedefe nasıl uyduğunu tek-iki kısa cümleyle açıkla.
- Eğer kullanıcı bir DİYET LİSTESİ verdiyse, önerileri o listedeki öğünlere ve mantığa (porsiyon, içerik) mümkün olduğunca uydur.
- Eğer bir HEDEF verdiyse (örn. kilo verme, kas), makroları ona göre dengele (örn. yüksek protein).

Üslubun: Türkçe, sıcak, net, abartısız. Tahminlerin gerçekçi olsun; gramajlar ölçülebilir ve makul porsiyonlar olsun.`

// Eldeki urunlerin fotografindan gramajli ogun onerileri + makrolar uretir
export async function suggestMeal(opts: {
  apiKey: string
  photoDataUrl: string
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
}): Promise<MealAdvice> {
  const { apiKey, photoDataUrl, model = DEFAULT_MODEL, userName, goal, dietPlan } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const img = splitDataUrl(photoDataUrl)
  if (!img) throw new Error('Fotoğraf okunamadı, lütfen tekrar deneyin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcının adı: ${userName}.`)
  if (goal) ctx.push(`Diyet hedefi: ${goal}.`)
  const ctxText = ctx.length ? `\n\nKullanıcı bağlamı: ${ctx.join(' ')}` : ''
  const planText = dietPlan?.trim()
    ? `\n\nDİYET LİSTEM (önerileri buna uydur):\n${dietPlan.trim()}`
    : ''

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2500,
      system: MEAL_SYSTEM,
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
              text: `Elimde bunlar var. Bunlardan diyetime uygun ne yapıp ne kadar yiyebilirim? Gramaj ve makro (protein/karbonhidrat/yağ) ver.${ctxText}${planText}`
            }
          ]
        }
      ],
      output_config: { format: { type: 'json_schema', schema: MEAL_SCHEMA } }
    })

    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi. Farklı bir fotoğraf deneyin.')
    if (response.stop_reason === 'max_tokens') throw new Error('Yanıt çok uzun oldu ve yarıda kesildi. Daha az ürünle tekrar deneyin.')

    const rawText = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!rawText) throw new Error('Modelden boş yanıt geldi. Lütfen tekrar deneyin.')
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    try {
      return JSON.parse(cleaned) as MealAdvice
    } catch {
      throw new Error(`Yapay zeka yanıtı çözümlenemedi. Gelen yanıt: "${cleaned.slice(0, 120)}…"`)
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

// Tahlil/lab sonucunu (foto veya PDF) okuyup duz, duzenli metne cevirir
export async function extractLabText(opts: {
  apiKey: string
  dataUrl: string
  model?: string
}): Promise<string> {
  const { apiKey, dataUrl, model = DEFAULT_MODEL } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const block = mediaBlock(dataUrl)
  if (!block) throw new Error('Dosya okunamadı (yalnızca görsel veya PDF).')

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system:
        'Sen bir tıbbi tahlil okuyucususun. Verilen tahlil/lab sonucundaki TÜM test adlarını, değerlerini, birimlerini ve (varsa) referans aralıklarını düzenli, okunaklı bir metne dök. Tarih varsa en üste yaz. Yorum/teşhis EKLEME, sadece veriyi sadık şekilde metne çevir. Sonuç bulunamazsa "Okunabilir tahlil verisi bulunamadı." yaz.',
      messages: [
        {
          role: 'user',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [block as any, { type: 'text', text: 'Bu tahlili düzenli bir metne çevir.' }]
        }
      ]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi. Farklı bir dosya deneyin.')
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('Tahlilden metin çıkarılamadı. Daha net bir görsel/PDF deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// Kayitli tahlilleri sade bir dille yorumlar/karsilastirir (tibbi teshis koymaz)
export async function analyzeLabs(opts: {
  apiKey: string
  labsText: string
  model?: string
  userName?: string
  goal?: string
}): Promise<string> {
  const { apiKey, labsText, model = DEFAULT_MODEL, userName, goal } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Diyet hedefi: ${goal}.`)

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: `Sen bir sağlık asistanısın. Kullanıcının geçmiş tahlil sonuçlarını sade, anlaşılır Türkçe ile yorumla: hangi değerler normal/yüksek/düşük görünüyor, zamanla nasıl değişmiş, diyet/beslenme açısından nelere dikkat edebilir. ÇOK ÖNEMLİ: Bu tıbbi teşhis veya tedavi değildir; kesin değerlendirme için doktora danışması gerektiğini mutlaka belirt. ${ctx.join(' ')}`,
      messages: [
        {
          role: 'user',
          content: `İşte tahlillerim (tarih sırasıyla). Bunları yorumla ve diyetim için önerilerde bulun:\n\n${labsText}`
        }
      ]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('Yorum üretilemedi. Lütfen tekrar deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}
