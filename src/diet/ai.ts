// Claude API ile fotograftan yemek tanima ve motivasyon uretimi.
// Tarayicidan dogrudan cagrilir (kullanici kendi API anahtarini saglar).
// NOT: SDK yalnizca cagri aninda (dinamik import) yuklenir; boylece sayfa
// acilisinda SDK yuzunden bir hata olsa bile uygulama yine de acilir.
import type { FoodAnalysis, MealAdvice, ShoppingSuggestion } from './types'

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
    protein: { type: 'integer' },
    carb: { type: 'integer' },
    fat: { type: 'integer' },
    dietScore: { type: 'integer' },
    scoreReason: { type: 'string' },
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
    'protein',
    'carb',
    'fat',
    'dietScore',
    'scoreReason',
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

TÜRK DİYETİSYEN/EV ÖLÇÜLERİ: Kullanıcı miktarı şu ölçülerle verebilir; bunları grama çevirip kaloriyi ona göre hesapla:
- 1 çorba kaşığı ≈ 15 g (pilav/makarna/yoğurt gibi için ~20 g; zeytinyağı ~12 g)
- 1 tatlı kaşığı ≈ 7 g, 1 çay kaşığı ≈ 5 g
- 1 su bardağı ≈ 200 ml, 1 çay bardağı ≈ 100 ml, 1 kahve fincanı ≈ 60 ml
- 1 avuç ≈ 30 g, 1 dilim ekmek ≈ 25-30 g, 1 köfte kadar ≈ 30 g
- "porsiyon", "adet", "kaşık" gibi ifadeleri makul gramaja çevir.
Örn. "5 çorba kaşığı pilav" ≈ 100 g pişmiş pilav → ona göre kalori ver.

MAKROLAR: Sadece kaloriyi değil, tahmini MAKRO besinleri de ver — protein, carb (karbonhidrat), fat (yağ); hepsi GRAM cinsinden tam sayı. Porsiyon büyüklüğüne göre gerçekçi tahmin et. Görselde yemek yoksa hepsi 0.

DİYET PUANI: dietScore alanına bu yemeğe diyete uygunluk açısından 1-10 arası bir puan ver (10 = mükemmel/diyete tam uygun, 7-9 = iyi, 4-6 = idareli, 1-3 = kötü/diyeti bozar). Varsa diyet listesine uyumu ve sağlıklılığı birlikte değerlendir. Görselde yemek yoksa dietScore=0.

PUANI NEREDEN KIRDIĞIN (çok önemli): scoreReason alanına puanı NEDEN tam vermediğini, yani puanı NEREDEN KIRDIĞINI kısa ve net yaz; böylece kullanıcı bir dahakine nelere dikkat edeceğini bilsin (örn. "Porsiyon biraz fazla ve kızartma olduğu için -2; yağ yüksek." veya "Listende beyaz ekmek yerine tam buğday var, o yüzden -1."). Madde madde değil, 1-2 kısa cümle. Puan 10 ise (mükemmelse) scoreReason="" (boş) bırak.

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
  body?: string // Kisi bilgisi: boy/yas/cinsiyet/kilo (porsiyon-kalori icin baglam)
}

// Fotografi inceler ve yapilandirilmis sonucu dondurur
export async function analyzeFood(opts: AnalyzeOptions): Promise<FoodAnalysis> {
  const { apiKey, photoDataUrl, model = DEFAULT_MODEL, userName, goal, dietPlan, note, body } = opts

  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const img = splitDataUrl(photoDataUrl)
  if (!img) throw new Error('Fotoğraf okunamadı, lütfen tekrar deneyin.')

  // Kullanici baglamini (isim/hedef/vucut) ek bir not olarak ilet
  const contextLines: string[] = []
  if (userName) contextLines.push(`Kullanıcının adı: ${userName}.`)
  if (body) contextLines.push(body)
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
  body?: string
}): Promise<FoodAnalysis> {
  const { apiKey, note, model = DEFAULT_MODEL, userName, goal, dietPlan, body } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!note.trim()) throw new Error('Yemeğin ne olduğunu yaz.')

  const contextLines: string[] = []
  if (userName) contextLines.push(`Kullanıcının adı: ${userName}.`)
  if (body) contextLines.push(body)
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

// Yemek sohbetinin yapilandirilmis ciktisi: cevap + (varsa) duzeltme.
// Kullanici sohbette yemegi/miktari duzeltirse, puan/kalori burada guncellenir.
const CHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    correction: {
      type: 'object',
      additionalProperties: false,
      properties: {
        changed: { type: 'boolean' },
        foodName: { type: 'string' },
        dietScore: { type: 'integer' },
        scoreReason: { type: 'string' },
        estimatedCalories: { type: 'integer' },
        protein: { type: 'integer' },
        carb: { type: 'integer' },
        fat: { type: 'integer' }
      },
      required: ['changed', 'foodName', 'dietScore', 'scoreReason', 'estimatedCalories', 'protein', 'carb', 'fat']
    }
  },
  required: ['reply', 'correction']
} as const

export interface FoodChatResult {
  reply: string
  correction: {
    changed: boolean
    foodName: string
    dietScore: number
    scoreReason: string
    estimatedCalories: number
    protein: number
    carb: number
    fat: number
  }
}

// Yemek hakkinda SOHBET (sadece metin -> az token). Fotograf tekrar gonderilmez;
// yemegin adi/baglami metin olarak verilir, kullanicinin sorularina kisa cevap.
// Kullanici yemegi/miktari duzeltirse correction.changed=true ile yeni puan/kalori doner.
export async function chatAboutFood(opts: {
  apiKey: string
  foodName: string
  dietScore: number
  estimatedCalories: number
  protein: number
  carb: number
  fat: number
  context?: string
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
}): Promise<FoodChatResult> {
  const { apiKey, foodName, dietScore, estimatedCalories, protein, carb, fat, context, history, model = DEFAULT_MODEL, userName, goal, dietPlan } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Bir soru yaz.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcının adı: ${userName}.`)
  if (goal) ctx.push(`Diyet hedefi: ${goal}.`)
  if (dietPlan?.trim()) ctx.push(`Diyet listesi:\n${dietPlan.trim()}`)

  const system = `Sen "Diyet Koçu"sun. Kullanıcı şu an "${foodName}" hakkında seninle konuşuyor.${
    context ? ` Bilgi: ${context}` : ''
  }
Mevcut değerler: yemek adı "${foodName}", diyet puanı ${dietScore}/10, tahmini kalori ${estimatedCalories} kcal, makro: ${protein}g protein / ${carb}g karbonhidrat / ${fat}g yağ.

reply alanına Türkçe, KISA (1-3 cümle), net ve yardımcı bir cevap yaz. Diyet/beslenme açısından pratik öneriler sun, abartma, suçlama.

ÇOK ÖNEMLİ — DÜZELTME: Eğer kullanıcı bu sohbette yemeği veya miktarı DÜZELTİRSE (örn. "bu aslında bamya değil fasulye", "yarım porsiyon yedim", "aslında 2 dilim") ya da senden puanı/kaloriyi güncellemeni isterse:
- correction.changed = true yap.
- correction.foodName = düzeltilmiş yemek adı (değişmediyse mevcut adı yaz).
- correction.dietScore = düzeltilmiş duruma göre 1-10 arası YENİ diyet puanı (10=mükemmel, 1=çok kötü). Varsa diyet listesine uyumu ve sağlıklılığı birlikte değerlendir.
- correction.scoreReason = puanı neden tam vermediğini (nereden kırdığını) 1-2 kısa cümleyle yaz; puan 10 ise boş bırak.
- correction.estimatedCalories = düzeltilmiş tahmini kalori. correction.protein/carb/fat = düzeltilmiş makrolar (gram, tam sayı).
- reply alanında puanı/kaloriyi GÜNCELLEDİĞİNİ kısaca söyle (örn. "Düzelttim, yeni puanın 8/10.").
Eğer ortada bir düzeltme YOKSA (sadece soru soruyorsa): correction.changed = false ve tüm alanlara MEVCUT değerleri aynen yaz (scoreReason'a mevcut kırılma sebebini yazabilirsin).
${ctx.join(' ')}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages: history.map((m) => ({ role: m.role, content: m.text })),
      output_config: { format: { type: 'json_schema', schema: CHAT_SCHEMA } }
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('Cevap üretilemedi. Lütfen tekrar deneyin.')
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    try {
      return JSON.parse(cleaned) as FoodChatResult
    } catch {
      // JSON cozulmezse en azindan metni cevap olarak goster, duzeltme yok say
      return {
        reply: cleaned,
        correction: { changed: false, foodName, dietScore, scoreReason: '', estimatedCalories, protein, carb, fat }
      }
    }
  } catch (err) {
    throw friendlyError(err)
  }
}

// Diyet LISTESI hakkinda sohbet (sadece metin -> az token). "Öğlen ne var",
// "sıradaki öğün ne" gibi sorulari listeye gore yanitlar.
export async function chatAboutPlan(opts: {
  apiKey: string
  dietPlan: string
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
}): Promise<string> {
  const { apiKey, dietPlan, history, model = DEFAULT_MODEL, userName, goal } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!dietPlan.trim()) throw new Error('Önce Ayarlar/Menü bölümünden diyet listeni ekle.')
  if (!history.length) throw new Error('Bir soru yaz.')

  const now = new Date().toLocaleString('tr-TR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  const system = `Sen "Diyet Koçu"sun. Kullanıcının diyet/öğün listesi aşağıda. Sorularını YALNIZCA bu listeye göre yanıtla (örn. "öğlen ne var", "sıradaki öğünde ne var"). Şu anki zaman: ${now}. Türkçe, KISA ve net cevap ver. ${ctx.join(
    ' '
  )}\n\nDİYET LİSTESİ:\n${dietPlan.trim()}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system,
      messages: history.map((m) => ({ role: m.role, content: m.text }))
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('Cevap üretilemedi.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// Diyet listesini istenen degisiklige gore gunceller; SADECE yeni tam listeyi dondurur.
export async function editPlan(opts: {
  apiKey: string
  dietPlan: string
  instruction: string
  model?: string
}): Promise<string> {
  const { apiKey, dietPlan, instruction, model = DEFAULT_MODEL } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!instruction.trim()) throw new Error('Ne değişsin, yaz.')

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system:
        'Sen bir diyet listesi editörüsün. Kullanıcının mevcut öğün listesini, istediği değişikliğe göre güncelle. SADECE güncellenmiş TAM listeyi düz metin olarak döndür; açıklama, giriş cümlesi, kod bloğu ekleme. Öğün başlıklarını (Kahvaltı, Öğle vb.) ve düzeni koru.',
      messages: [
        {
          role: 'user',
          content: `MEVCUT LİSTE:\n${dietPlan.trim() || '(boş)'}\n\nİSTENEN DEĞİŞİKLİK: ${instruction.trim()}\n\nGüncellenmiş tam listeyi ver.`
        }
      ]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('Liste güncellenemedi.')
    return text.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '').trim()
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

// Alisveris listesi cikti semasi (kategorilere ayrilmis urunler)
const SHOPPING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                meals: { type: 'array', items: { type: 'string' } }
              },
              required: ['name', 'meals']
            }
          }
        },
        required: ['name', 'items']
      }
    },
    note: { type: 'string' }
  },
  required: ['categories', 'note']
} as const

// Diyet listesine gore, kategorilere ayrilmis bir alisveris listesi uretir.
// Token harcar ama tek seferlik ve kucuk (sadece metin).
export async function suggestShopping(opts: {
  apiKey: string
  dietPlan: string
  days?: number // Kac gunluk alisveris (varsayilan 7)
  model?: string
  userName?: string
  goal?: string
}): Promise<ShoppingSuggestion> {
  const { apiKey, dietPlan, days = 7, model = DEFAULT_MODEL, userName, goal } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!dietPlan.trim()) throw new Error('Önce Ayarlar/Menü bölümünden diyet listeni ekle.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)

  const system = `Sen "Diyet Koçu" adında bir beslenme asistanısın. Kullanıcının DİYET LİSTESİNE bakarak, o listedeki öğünleri yapabilmesi için gereken ALIŞVERİŞ LİSTESİNİ çıkar.

Kurallar:
- Listeyi ÜRÜN TİPİNE/KATEGORİSİNE göre grupla. Tipik kategoriler: "Sebze & Meyve", "Et, Tavuk & Balık", "Süt Ürünleri & Yumurta", "Tahıl & Bakliyat", "Kuruyemiş & Tohum", "İçecek", "Diğer". Sadece gerçekten gereken kategorileri kullan.
- Her kategoride, diyet listesinde geçen veya o öğünleri yapmak için gereken ürünleri yaz. Her ürün bir nesnedir: name (ürün adı) + meals (hangi öğünlerde geçtiği). Ürün adlarını KISA ve sade tut (örn. "yumurta", "tam buğday ekmeği", "yağsız yoğurt", "tavuk göğsü", "brokoli"). İstersen name içine yaklaşık miktar ekleyebilirsin (örn. "yulaf (1 paket)").
- meals alanına, o ürünün diyet listesinde GEÇTİĞİ ÖĞÜNLERİN adlarını yaz (listedeki öğün başlıklarını kullan: örn. "Kahvaltı", "Ara öğün", "Öğle", "İkindi", "Akşam", "Gece"). Bir ürün birden çok öğünde geçiyorsa hepsini yaz (örn. ["Kahvaltı","Akşam"]). Hangi öğünde olduğu listeden net değilse en olası öğünü yaz; genel bir temel malzemeyse boş [] bırakabilirsin.
- Yaklaşık ${days} günlük ihtiyaca göre düşün. Aşırıya kaçma; pratik ve gerçekçi bir liste olsun.
- Diyet listesinde olmayan, sağlıksız (şekerli/işlenmiş) ürünler EKLEME.
- note alanına TEK kısa cümlelik bir bilgi yaz (örn. "Listene göre ~${days} günlük temel alışveriş.").

Üslubun: Türkçe, sade, abartısız. ${ctx.join(' ')}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: 'user',
          content: `İşte diyet listem. Bunu yapabilmem için kategorilere ayrılmış bir alışveriş listesi çıkar:\n\n${dietPlan.trim()}`
        }
      ],
      output_config: { format: { type: 'json_schema', schema: SHOPPING_SCHEMA } }
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    if (response.stop_reason === 'max_tokens') throw new Error('Yanıt yarıda kesildi. Lütfen tekrar deneyin.')
    const rawText = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!rawText) throw new Error('Modelden boş yanıt geldi. Lütfen tekrar deneyin.')
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    try {
      return JSON.parse(cleaned) as ShoppingSuggestion
    } catch {
      throw new Error(`Yapay zeka yanıtı çözümlenemedi. Gelen yanıt: "${cleaned.slice(0, 120)}…"`)
    }
  } catch (err) {
    throw friendlyError(err)
  }
}

// Egzersizden YAKILAN KALORIYI yapay zeka ile tahmin eder (kucuk, metin).
const BURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { kcal: { type: 'integer' }, note: { type: 'string' } },
  required: ['kcal', 'note']
} as const

export async function estimateExerciseKcal(opts: {
  apiKey: string
  text: string
  minutes?: number
  weightKg?: number
  model?: string
}): Promise<{ kcal: number; note: string }> {
  const { apiKey, text, minutes, weightKg, model = DEFAULT_MODEL } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!text.trim()) throw new Error('Egzersizi yaz.')

  const parts: string[] = [`Egzersiz: "${text.trim()}".`]
  if (minutes) parts.push(`Süre: ${minutes} dakika.`)
  if (weightKg) parts.push(`Kişinin kilosu: ${weightKg} kg.`)

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 300,
      system:
        'Sen bir spor/beslenme asistanısın. Verilen egzersizi (tür, süre, kilo) değerlendirip YAKLAŞIK YAKILAN KALORİYİ tahmin et. kcal alanına tam sayı yaz. Süre verilmemişse egzersiz türünden makul bir süre varsay. note alanına çok kısa (tek cümle) bir açıklama yaz (örn. "30 dk tempolu yürüyüş ~150 kcal"). Türkçe.',
      messages: [{ role: 'user', content: parts.join(' ') + ' Yaklaşık kaç kalori yakılmıştır?' }],
      output_config: { format: { type: 'json_schema', schema: BURN_SCHEMA } }
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const raw = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const obj = JSON.parse(cleaned) as { kcal: number; note: string }
    return { kcal: Math.max(0, Math.round(obj.kcal || 0)), note: obj.note || '' }
  } catch (err) {
    throw friendlyError(err)
  }
}

// Gunu degerlendirme sohbeti ("Z raporu"): bugunku ozet baglam olarak
// verilir, kullanici "bugun niye boyle" gibi konusur. Sadece metin -> az token.
export async function chatAboutDay(opts: {
  apiKey: string
  daySummary: string
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
}): Promise<string> {
  const { apiKey, daySummary, history, model = DEFAULT_MODEL, userName, goal, dietPlan } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Bir şey yaz.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (dietPlan?.trim()) ctx.push(`Diyet listesi:\n${dietPlan.trim()}`)

  const system = `Sen "Diyet Koçu"sun. Kullanıcının BUGÜNKÜ özeti aşağıda. Kullanıcı günü seninle değerlendiriyor ("bugün nasıl geçti", "niye böyle oldu", "yarın ne yapayım" gibi). Türkçe, KISA (1-4 cümle), sıcak, somut ve motive edici cevap ver; suçlama yok. Gerektiğinde bugünkü verilere atıfta bulun. ${ctx.join(' ')}

BUGÜNÜN ÖZETİ:
${daySummary}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system,
      messages: history.map((m) => ({ role: m.role, content: m.text }))
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Cevap üretilemedi.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// Haftalik koc ozeti: son N gunluk verilerden kisa, motive edici bir
// degerlendirme yazar (kucuk, tek seferlik token). data = ozet metni.
export async function weeklyCoachSummary(opts: {
  apiKey: string
  data: string
  days: number
  model?: string
  userName?: string
  goal?: string
}): Promise<string> {
  const { apiKey, data, days, model = DEFAULT_MODEL, userName, goal } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)

  const system = `Sen "Diyet Koçu"sun. Kullanıcının son ${days} günlük diyet verileri aşağıda verilecek. Bunlara bakarak KISA (4-6 cümle), sıcak ve motive edici bir haftalık değerlendirme yaz:
- Neyi iyi yaptığını öv (somut sayılarla).
- En çok zorlandığı/dikkat etmesi gereken noktayı nazikçe söyle.
- 1-2 SOMUT, uygulanabilir öneri ver (örn. belirli bir öğün, porsiyon, egzersiz).
Türkçe, abartısız, suçlayıcı değil güçlendirici ol. Başlık/madde işareti kullanma, düz paragraf yaz. ${ctx.join(' ')}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: `Son ${days} günün verileri:\n\n${data}\n\nBunları değerlendir.` }]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('Özet üretilemedi. Lütfen tekrar deneyin.')
    return text
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
