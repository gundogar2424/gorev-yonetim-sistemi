// Claude API ile fotograftan yemek tanima ve motivasyon uretimi.
// Tarayicidan dogrudan cagrilir (kullanici kendi API anahtarini saglar).
// NOT: SDK yalnizca cagri aninda (dinamik import) yuklenir; boylece sayfa
// acilisinda SDK yuzunden bir hata olsa bile uygulama yine de acilir.
import type { FoodAnalysis, MealAdvice, ShoppingSuggestion } from './types'
import { recordUsage } from './lib/usage'

export const DEFAULT_MODEL = 'claude-opus-4-8'

// SDK'yi geç (lazy) yukle ve istemciyi olustur. messages.create sarmalanir:
// her cevaptan gelen token kullanimi merkezi olarak kaydedilir (Ayarlar'da
// gosterilir). Boylece 17 ayri cagriya dokunmadan tek yerden sayilir.
async function createClient(apiKey: string) {
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const origCreate = client.messages.create.bind(client.messages)
  client.messages.create = ((params: unknown, options?: unknown) => {
    const ret = origCreate(params as never, options as never)
    // Sadece normal (stream olmayan) yanitlarda usage vardir
    Promise.resolve(ret as unknown)
      .then((res) => {
        const u = (res as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage
        if (u) recordUsage(u.input_tokens ?? 0, u.output_tokens ?? 0)
      })
      .catch(() => {
        /* hata zaten cagirana gider; burada yok say */
      })
    return ret
  }) as typeof client.messages.create
  return client
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
  // Baglanti hatalari: SDK sinif adi minified derlemede degisebildigi icin
  // mesaj metnine de bakilir ("Connection error." Ingilizce sizmasin).
  if (
    e?.name === 'APIConnectionError' ||
    e?.name === 'APIConnectionTimeoutError' ||
    detail.toLowerCase().includes('connection') ||
    detail.toLowerCase().includes('network') ||
    detail.toLowerCase().includes('fetch failed')
  ) {
    return new Error('İnternet bağlantısı kurulamadı. Bağlantını kontrol edip tekrar dene. 📶')
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
  dietitianNotes?: string // Diyetisyenin talimatlari — degerlendirmede mutlaka dikkate alinir
  health?: string // Ortak saglik akli baglami (tum veritabanindan ozet)
}

// Diyetisyen talimatlarini baglam metnine cevirir (varsa)
function dietitianText(notes?: string): string {
  return notes?.trim()
    ? `\n\nDİYETİSYENİN TALİMATLARI (bunlara MUTLAKA uy; değerlendirme, puan ve önerilerinde dikkate al): ${notes.trim()}`
    : ''
}

// Ortak saglik akli baglamini metne cevirir (varsa). Tum modullere gider;
// model alakali olanlara deginir (orn. kilo sabit ama bel incelmisse
// "yagdan gitmis olabilir", sekeri yuksekse ona gore konusur).
function healthText(h?: string): string {
  return h?.trim()
    ? `\n\nKULLANICININ GÜNCEL SAĞLIK/İLERLEME VERİLERİ (uygulamanın veritabanından; değerlendirmende bunları da göz önünde tut, alakalı olanlara kısaca değin. Örn. kilo sabitken bel inceliyorsa "kaybın yağdan, kas korunuyor" gibi bütünsel yorum yap; şekeri/tansiyonu yüksekse önerini ona göre şekillendir):\n${h.trim()}`
    : ''
}

// Fotografi inceler ve yapilandirilmis sonucu dondurur
export async function analyzeFood(opts: AnalyzeOptions): Promise<FoodAnalysis> {
  const { apiKey, photoDataUrl, model = DEFAULT_MODEL, userName, goal, dietPlan, note, body, dietitianNotes, health } = opts

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
    ? `\n\nKULLANICININ NOTU/DÜZELTMESİ (ÇOK ÖNEMLİ): "${note.trim()}". Bu, yemekle ilgili EK BİLGİ ve düzeltmedir. Kurallar: (1) Notun belirttiği her şeyi (isim, içerik, miktar, pişirme, şeker/yağ durumu) KESİN doğru kabul et ve uygula; görselle çelişse bile notu esas al. (2) ANCAK fotoğrafta AÇIKÇA görünen ve notun YALANLAMADIĞI diğer öğeleri de öğüne DAHİL ET, sakın atma — kullanıcı bir şeyi yazmayı unutmuş olabilir. (3) Yalnızca kullanıcı "sadece/yalnızca şu var" gibi net sınırlarsa öğünü tam olarak onunla sınırla. (4) Belirtilen miktar/porsiyonu kaloride dikkate al.`
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
              text: `Bu yemeği yemek üzereyim. Diyetimi bozmadan önce beni değerlendir. ÖNEMLİ: Aşağıdaki bilgide yemeğin TAMAMININ yenmediği/bir kısmının bırakıldığı belirtiliyorsa (örn. "yarısını yedim", "üçte birini bıraktım", "birkaç kaşık yedim"), kaloriyi ve makroyu SADECE YENEN miktara göre hesapla, tabaktaki tümüne göre değil; foodName'de de ne kadar yendiğini belirt.${contextText}${planText}${dietitianText(dietitianNotes)}${healthText(health)}${noteText}`
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

// PAKET ETIKETI (besin degerleri tablosu) fotografindan 100 g/ml icin
// kalori + makrolari okur. Barkod veritabaninda bulunamayan urunler icin.
const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    found: { type: 'boolean' },
    name: { type: 'string' },
    kcal: { type: 'number' },
    protein: { type: 'number' },
    carb: { type: 'number' },
    fat: { type: 'number' },
    per: { type: 'string', enum: ['100g', 'porsiyon', 'bilinmiyor'] }
  },
  required: ['found', 'name', 'kcal', 'protein', 'carb', 'fat', 'per']
} as const

export async function readNutritionLabel(opts: {
  apiKey: string
  photoDataUrl: string
  model?: string
}): Promise<{ found: boolean; name: string; kcal: number; protein: number; carb: number; fat: number; per: string }> {
  const { apiKey, photoDataUrl, model = DEFAULT_MODEL } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const img = splitDataUrl(photoDataUrl)
  if (!img) throw new Error('Fotoğraf okunamadı, lütfen tekrar deneyin.')

  const system = `Bir paketli gıdanın BESİN DEĞERLERİ tablosunu (etiketi) okuyacaksın. Amaç: 100 g/ml için değerleri çıkarmak.
- kcal = 100 g/ml için enerji (kalori). Etikette kJ ve kcal varsa KCAL değerini al. kcal yoksa kJ'yi 4.184'e bölerek yaklaşık kcal ver.
- protein, carb (karbonhidrat), fat (yağ) = 100 g/ml için GRAM.
- Etikette "100 g" sütunu varsa onu kullan (per="100g"). Yoksa yalnızca porsiyon başına verilmişse o değerleri ver ve per="porsiyon" yaz. Belli değilse per="bilinmiyor".
- Ürün adını (marka/ürün) tablodan ya da paketten oku; okunamıyorsa kısa genel bir ad yaz.
- Tablo net okunamıyorsa found=false ve değerleri 0 ver.
Sadece tablodaki gerçek rakamları kullan; uydurma. Türkçe ad ver.`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 500,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.mediaType as 'image/jpeg', data: img.base64 } },
            { type: 'text', text: 'Bu paketin besin değerleri tablosunu oku ve 100 g/ml için kalori + makroları çıkar.' }
          ]
        }
      ],
      output_config: { format: { type: 'json_schema', schema: LABEL_SCHEMA } }
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const raw = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(cleaned)
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
  dietitianNotes?: string
  health?: string
}): Promise<FoodAnalysis> {
  const { apiKey, note, model = DEFAULT_MODEL, userName, goal, dietPlan, body, dietitianNotes, health } = opts
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
          content: `Bu yemeği yemek üzereyim (fotoğraf yok, sana ben tarif ediyorum): "${note.trim()}". foodName ve kalori/miktarı bu tarife göre belirle. Diyetimi bozmadan önce beni değerlendir.${contextText}${planText}${dietitianText(dietitianNotes)}${healthText(health)}`
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
  dietitianNotes?: string
  health?: string
}): Promise<FoodChatResult> {
  const { apiKey, foodName, dietScore, estimatedCalories, protein, carb, fat, context, history, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Bir soru yaz.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcının adı: ${userName}.`)
  if (goal) ctx.push(`Diyet hedefi: ${goal}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları (mutlaka dikkate al): ${dietitianNotes.trim()}.`)
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
${ctx.join(' ')}${healthText(health)}`

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
  health?: string
}): Promise<string> {
  const { apiKey, dietPlan, history, model = DEFAULT_MODEL, userName, goal, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!dietPlan.trim()) throw new Error('Önce Ayarlar/Menü bölümünden diyet listeni ekle.')
  if (!history.length) throw new Error('Bir soru yaz.')

  const now = new Date().toLocaleString('tr-TR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  const system = `Sen "Diyet Koçu"sun. Kullanıcının diyet/öğün listesi aşağıda. Sorularını YALNIZCA bu listeye göre yanıtla (örn. "öğlen ne var", "sıradaki öğünde ne var"). Şu anki zaman: ${now}. Sağlık bağlamı verildiyse (şeker, rahatsızlık, sevmediği/alerjik yiyecekler) ona AYKIRI öneri verme. Türkçe, KISA ve net cevap ver. ${ctx.join(
    ' '
  )}\n\nDİYET LİSTESİ:\n${dietPlan.trim()}${healthText(health)}`

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
                grams: { type: 'integer' },
                measure: { type: 'string' }
              },
              required: ['name', 'grams', 'measure']
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
- Her öneri için items dizisinde her ürünün miktarını HEM ev ölçüsü HEM gram olarak ver: "grams" alanına gram (tam sayı), "measure" alanına EV ÖLÇÜSÜ yaz. Ev ölçüsü, diyetisyenlerin kullandığı pratik birimlerle olsun: çay kaşığı, tatlı kaşığı, çorba kaşığı, su bardağı (~200 ml), çay bardağı, dilim, adet, avuç, orta boy vb. (örn. "3 çorba kaşığı", "1 su bardağı (~200 ml)", "2 dilim", "1 orta boy"). Sıvı/içecekleri bardak, taneli/dilimli şeyleri adet/dilim olarak ver; sadece gram uygun düşen şeyleri gram-ağırlıklı yaz.
- KULLANICI porsiyon birimi tercihi belirttiyse (örn. "gram ver", "kaşık/bardak olsun", "diyetisyenim şöyle veriyor") ona MUTLAKA uy; "measure" alanını o tercihe göre doldur.
- Her öneri için SADECE kalori değil MAKRO besinleri de hesapla: protein, carb (karbonhidrat), fat (yağ) — hepsi GRAM cinsinden tam sayı. calories = toplam tahmini kalori.
- reason alanında bu önerinin neden iyi olduğunu ve (varsa) diyet listesine/hedefe nasıl uyduğunu tek-iki kısa cümleyle açıkla.
- Eğer kullanıcı bir DİYET LİSTESİ verdiyse, önerileri o listedeki öğünlere ve mantığa (porsiyon, içerik) mümkün olduğunca uydur.
- Eğer bir HEDEF verdiyse (örn. kilo verme, kas), makroları ona göre dengele (örn. yüksek protein).

Üslubun: Türkçe, sıcak, net, abartısız. Tahminlerin gerçekçi olsun; gramajlar ölçülebilir ve makul porsiyonlar olsun.`

// Eldeki urunlerin fotografindan gramajli ogun onerileri + makrolar uretir
export async function suggestMeal(opts: {
  apiKey: string
  photoDataUrl?: string
  photoDataUrls?: string[] // birden fazla foto (masa/farkli yemekler/coklu sayfa)
  note?: string // kullanicinin dogruladigi/duzelttigi urun listesi (sohbetten)
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
  dietitianNotes?: string
  health?: string
}): Promise<MealAdvice> {
  const { apiKey, photoDataUrl, photoDataUrls, note, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const sources = (photoDataUrls?.length ? photoDataUrls : photoDataUrl ? [photoDataUrl] : [])
  const imgs = sources.map((u) => splitDataUrl(u)).filter((v): v is NonNullable<typeof v> => !!v)
  if (!imgs.length) throw new Error('Fotoğraf okunamadı, lütfen tekrar deneyin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcının adı: ${userName}.`)
  if (goal) ctx.push(`Diyet hedefi: ${goal}.`)
  const ctxText = ctx.length ? `\n\nKullanıcı bağlamı: ${ctx.join(' ')}` : ''
  const planText = dietPlan?.trim()
    ? `\n\nDİYET LİSTEM (önerileri buna uydur):\n${dietPlan.trim()}`
    : ''
  const noteText = note?.trim()
    ? `\n\nKULLANICININ DOĞRULADIĞI/DÜZELTTİĞİ ÜRÜNLER (fotoğraf üzerine konuştuk; ELDE OLAN ürünler KESİN olarak bunlardır — önerini bunlara göre yap, kullanıcının olmadığını söylediği şeyi kullanma, eklediğini dahil et):\n${note.trim()}`
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
            ...imgs.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType as 'image/jpeg', data: img.base64 }
            })),
            {
              type: 'text',
              text: `Elimde bunlar var${imgs.length > 1 ? ` (${imgs.length} fotoğrafa da bak — masadaki/farklı fotoğraflardaki tüm ürünleri birlikte değerlendir)` : ''}. Bunlardan diyetime uygun ne yapıp ne kadar yiyebilirim? Gramaj ve makro (protein/karbonhidrat/yağ) ver.${noteText}${ctxText}${planText}${dietitianText(dietitianNotes)}${healthText(health)}`
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
  health?: string
}): Promise<ShoppingSuggestion> {
  const { apiKey, dietPlan, days = 7, model = DEFAULT_MODEL, userName, goal, health } = opts
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

Üslubun: Türkçe, sade, abartısız. ${ctx.join(' ')}${healthText(health)}`

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
  health?: string
}): Promise<{ kcal: number; note: string }> {
  const { apiKey, text, minutes, weightKg, model = DEFAULT_MODEL, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!text.trim()) throw new Error('Egzersizi yaz.')

  const parts: string[] = [`Egzersiz: "${text.trim()}".`]
  if (minutes) parts.push(`Süre: ${minutes} dakika.`)
  if (weightKg) parts.push(`Kişinin kilosu: ${weightKg} kg.`)

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 400,
      system:
        'Sen bir spor/beslenme asistanısın. Verilen egzersizi (tür, süre, kilo) değerlendirip YAKLAŞIK YAKILAN KALORİYİ tahmin et. kcal alanına tam sayı yaz. Süre verilmemişse egzersiz türünden makul bir süre varsay. note alanına çok kısa (tek cümle) bir açıklama yaz (örn. "30 dk tempolu yürüyüş ~150 kcal"); kişinin sağlık durumu (şeker/tansiyon/rahatsızlık) verildiyse ve alakalıysa çok kısa bir uyarı/öneri ekleyebilirsin. Türkçe.',
      messages: [{ role: 'user', content: parts.join(' ') + ` Yaklaşık kaç kalori yakılmıştır?${healthText(health)}` }],
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
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, daySummary, history, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Bir şey yaz.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları (dikkate al): ${dietitianNotes.trim()}.`)
  if (dietPlan?.trim()) ctx.push(`Diyet listesi:\n${dietPlan.trim()}`)

  const system = `Sen "Diyet Koçu"sun ve gün sonunda kullanıcıya ESPRİLİ bir "Z RAPORU" kesiyorsun — tıpkı kasadaki gün sonu yazar kasa raporu gibi, ama diyet versiyonu. Üslubun: hafif muzip, tatlı-iğneleyici ama asla kırıcı değil; esnaf ağzıyla espri yapabilirsin ("kasa açığı", "ciro", "iade yok", "fiş kesildi" gibi kasa/POS terimlerini diyete uyarlayarak). Kullanıcı ilk kez "Z raporu" istediğinde kısa bir rapor formatı kur: birkaç satırda günün dökümü (öğün cirosu, vazgeçiş karı, kriz zayiatı, su/spor durumu) + tek cümlelik esprili kapanış + yarın için 1 somut öneri. Sonraki sorularda normal sohbet et ama esprili tonu koru. KISA yaz (rapor 5-8 kısa satır, sohbet 1-4 cümle). Rakamları bugünün verilerinden al, uydurma. Suçlayıcı olma; güldürerek motive et. ${ctx.join(' ')}

BUGÜNÜN ÖZETİ:
${daySummary}${healthText(health)}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 700,
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

// TEK KOC SOHBETI: ana ekrandaki tek sohbet kutusu. Menu sorulari, yarin
// plani, Z raporu, gun degerlendirmesi, beslenme sorulari — hepsi burada.
export async function coachChat(opts: {
  apiKey: string
  daySummary: string
  shoppingList?: string // alinacaklar (yarin plani icin)
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, daySummary, shoppingList, history, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Bir şey yaz.')

  const now = new Date().toLocaleString('tr-TR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları (mutlaka dikkate al): ${dietitianNotes.trim()}.`)

  const system = `Sen "Diyet Koçu"sun — deneyimli bir KLİNİK DİYETİSYEN ve YAŞAM KOÇU gibi konuşan uzman bir asistansın. Şu anki zaman: ${now}.

ÜSLUBUN (varsayılan): profesyonel, güven veren, sıcak ama ciddi. Bir uzmanın hastasıyla konuştuğu gibi: net bilgi, gerekçesiyle kısa açıklama, somut ve uygulanabilir öneri. Bilimsel ama anlaşılır dil; abartı, şaka ve laubalilik YOK. Suçlamak yerine yönlendir. Verilere dayan, uydurma.

Kullanıcı sana serbestçe yazar; ne istediğini anla ve yap:
- MENÜ soruları ("öğlen ne var", "sıradaki öğün ne", "akşama ne yiyeyim"): aşağıdaki DİYET LİSTESİ'nden, saate göre net cevapla.
- "YARINI PLANLA": yarının öğünlerini listeden düzenli şekilde çıkar; ALINACAKLAR listesi verilmişse karşılaştır, eksik malzeme riskini tek cümleyle belirt.
- "Z RAPORU" açıkça istenirse (SADECE o zaman): günün düzenli bir dökümünü rapor formatında ver (öğünler ve kaloriler, vazgeçişler, kriz anları, su/spor, günün başarısı) + yarın için 1 somut uzman önerisi. En fazla TEK hafif esprili kapanış cümlesi kullanabilirsin; raporun geri kalanı profesyonel kalsın.
- Gün değerlendirmesi, "niye böyle oldu", beslenme/sağlık soruları: bir diyetisyen gözüyle değerlendir; fizyolojik açıklamayı kısaca yap (örn. açlığın olası nedeni), 1-2 somut öneriyle bitir.
- HAFTALIK/İLERLEME DEĞERLENDİRMESİ ("son haftayı değerlendir", "nasıl gidiyorum", "ilerliyor muyum/geriliyor muyum"): Aşağıdaki sağlık verisindeki "EN SON ÖLÇÜM", kilo ve TÜM vücut ölçüsü eğilimlerini (bel/göbek/kalça/kol/bacak) MUTLAKA kullan ve sayılarla konuş (örn. "kilon 107→107.3, ama belin 128→127, bacağın 64→61 → yağ/su oynaması olabilir"). SADECE bu haftaya bakma: "BAŞLANGIÇTAN BUGÜNE GENEL", "başlangıçtan bugüne toplam değişim" ve spor/öğün geçmişi satırlarını kullanıp İLK KAYITTAN bugüne uzun vadeli gidişatı da yorumla — eski verilerdeki örüntüleri de işine kat. Kullanıcıya "kaç kilosun / tartıldın mı" diye SORMA — veri zaten aşağıda; yoksa "henüz ölçüm girilmemiş" de. Beslenme + spor + ilaç/vitamin ile birlikte bütünsel yorumla.

BUGÜNE ÖZEL PLAN/NOT (ÇOK ÖNEMLİ): Kullanıcı bugüne dair bir plan/durum belirtirse (örn. "bugün geç kahvaltı yapacağım, kahvaltı+ara öğünü birleştireceğim", "bugün oruçluyum", "akşam dışarıda yiyeceğim", "bugün sadece 2 öğün yiyeceğim"), bunu HATIRLAMAM için cevabının EN SONUNA, ayrı bir satırda tam olarak şu işareti ekle: [[NOT: kısa özet]] — bu satır kullanıcıya gösterilmez; günün notu olarak kaydedilir ve tüm değerlendirmelerde dikkate alınır. Böyle bir plan yoksa bu satırı EKLEME. Kullanıcı notu iptal/sil derse [[NOT: sil]] yaz.
Türkçe ve KISA yaz (rapor 6-10 satır, diğer cevaplar 1-4 cümle). ${ctx.join(' ')}

DİYET LİSTESİ:
${dietPlan?.trim() || '(liste girilmemiş — menü sorularında bunu belirt ve Ayarlar/Menü sayfasına yönlendir)'}

${shoppingList?.trim() ? `ALINACAKLAR LİSTESİ (henüz alınmadı): ${shoppingList.trim()}\n\n` : ''}BUGÜNÜN ÖZETİ:
${daySummary}${healthText(health)}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 700,
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

// RESTORAN/MENU yardimcisi: kullanici disarida menu fotograf(lar)ini yukler,
// yapay zeka diyetine EN UYGUN secenekleri oncelik sirasiyla cikarir; menu
// yoksa sohbet eder. Gorseller yalnizca ilk turda gonderilir (token tasarrufu).
export async function menuChat(opts: {
  apiKey: string
  images?: string[] // menu fotograf data URL'leri (yalnizca ilk mesajda)
  pdfDataUrl?: string // kare koddan gelen menu PDF'i (yalnizca ilk turda)
  menuText?: string // kare koddan gelen web sitesi menu metni (yalnizca ilk turda)
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, images = [], pdfDataUrl, menuText, history, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Bir şey yaz veya menü fotoğrafı ekle.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)

  const system = `Sen "Diyet Koçu"sun — deneyimli bir KLİNİK DİYETİSYEN. Kullanıcı ŞU AN DIŞARIDA/RESTORANDA ve ne yiyeceğine karar vermek istiyor. Sana restoran MENÜSÜNÜ fotoğraf(lar) olarak, kare koddaki web sitesinden çıkarılmış METİN olarak veya PDF olarak verebilir; ya da sadece seninle yazışabilir.

Görevin:
- Menü (foto/PDF/web metni) varsa: menüdeki yemekleri oku. Kullanıcının DİYET LİSTESİ ve hedefiyle en UYUMLU 2-3 seçeneği ÖNCELİK SIRASIYLA öner; her biri için tek satır gerekçe (neden uygun) ve varsa pratik uyarı ver (örn. "sosu ayrı iste", "kızartma yerine ızgara seç", "porsiyonu yarı bırak").
- KAÇINILMASI gereken 1-2 seçeneği de kısaca belirt (neden bozar).
- Menüde net diyet-uyumlu bir şey yoksa: en az zararlı seçeneği söyle ve onu nasıl "diyet dostu" hale getireceğini (porsiyon, pişirme, yan seçim) anlat.
- Menü fotoğrafı yoksa/okunamıyorsa: nasıl bir yer olduğunu sor veya genel bir öneri verip sohbet et.
- Sağlık verilerini dikkate al (örn. kan şekeri yüksekse şekerli/nişastalı ağırlıklı seçeneklerden uzak tut).
Türkçe, KISA ve net yaz; net bir "ben olsam şunu söylerdim" tavsiyesiyle bitir. Profesyonel, güven veren üslup; abartı ve şaka yok. ${ctx.join(' ')}

DİYET LİSTESİ:
${dietPlan?.trim() || '(liste girilmemiş — genel sağlıklı beslenme ilkelerine göre öner)'}${dietitianText(dietitianNotes)}${healthText(health)}`

  // Ekleri (foto + PDF) SON kullanici mesajina koy (yalnizca bu turda gonderilir)
  const attachBlocks = [...images, ...(pdfDataUrl ? [pdfDataUrl] : [])]
    .map((d) => mediaBlock(d))
    .filter((b): b is Record<string, unknown> => !!b)

  const lastIdx = history.length - 1
  const msgs = history.map((m, i) => {
    if (i === lastIdx && m.role === 'user') {
      // Web sitesinden cikarilan menu metnini kullanici mesajina ekle
      const txt = menuText?.trim()
        ? `${m.text}\n\nMENÜ İÇERİĞİ (kare koddaki web sitesinden alındı; buradaki yemeklere göre öner):\n${menuText.trim()}`
        : m.text
      if (attachBlocks.length) {
        return { role: 'user' as const, content: [...attachBlocks, { type: 'text' as const, text: txt }] }
      }
      return { role: 'user' as const, content: txt }
    }
    return { role: m.role, content: m.text }
  })

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({ model, max_tokens: 900, system, messages: msgs as never })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Cevap üretilemedi.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// KRIZ ANI sohbeti: kullanici SU AN bir yeme krizi yasiyor. Kisa, guclu,
// aninda uygulanabilir mudahale — kontrollu kacamak + oyalama taktigi.
export async function cravingHelp(opts: {
  apiKey: string
  context: string // bugunun ozeti + moral
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, context, history, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Ne çektiğini yaz.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları: ${dietitianNotes.trim()}.`)
  if (dietPlan?.trim()) ctx.push(`Diyet listesi:\n${dietPlan.trim()}`)

  const system = `Sen "Diyet Koçu"sun ve kullanıcı ŞU AN bir YEME KRİZİ yaşıyor — canı bir şey çekiyor ve yemek üzere. Bu bir acil müdahale anı. Görevin onu bu 10 dakikayı atlatması için desteklemek:
1. Önce kısaca anlayışla karşıla (1 cümle, suçlama YOK).
2. Hemen SOMUT bir taktik ver: büyük bir bardak su + 10 dakika bekleme, kısa yürüyüş, diş fırçalama, dikkat dağıtma gibi — duruma en uygun TEK taktiği seç.
3. Eğer dayanamayacaksa KONTROLLÜ KAÇAMAK öner: diyeti bozmayacak ölçülü net bir miktar (örn. "2 kare bitter çikolata ~20 g, orada dur").
4. Bugünkü verilerine ve hedefine atıfta bulunarak kısa, güçlü bir motivasyon cümlesiyle bitir.
KISA yaz (2-4 cümle), samimi ve kararlı ol. Türkçe. ${ctx.join(' ')}

BUGÜNÜN DURUMU:
${context}${healthText(health)}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 500,
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

// Yemek–şeker bağlantı analizi: ogunler ile sonrasindaki tok seker olcumlerini
// eslestirip kisisel oruntuler cikarir ("X yediginde sekerin yukseliyor").
export async function analyzeMealSugar(opts: {
  apiKey: string
  pairsText: string // eslesmis olcum-ogun satirlari
  model?: string
  userName?: string
  goal?: string
  medications?: string
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, pairsText, model = DEFAULT_MODEL, userName, goal, medications, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!pairsText.trim()) throw new Error('Analiz için yeterli veri yok.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (medications?.trim()) ctx.push(`Kullandığı ilaçlar: ${medications.trim()}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları: ${dietitianNotes.trim()}.`)

  const system = `Sen bir sağlık asistanısın. Kullanıcının KAN ŞEKERİ ölçümleri ile öncesinde yediği ÖĞÜNLER eşleştirilmiş olarak verilecek. Görevin bu KİŞİYE ÖZEL örüntüleri bulmak:
- Hangi yemeklerden/öğün tiplerinden sonra şekeri belirgin yükseliyor, hangilerinden sonra iyi seyrediyor — SOMUT örneklerle yaz (örn. "Pilavlı öğünler sonrası ort. ~160, tavuk-salata sonrası ~120").
- Açlık ölçümlerinin genel seyrini değerlendir.
- Bu örüntülere göre 2-3 pratik beslenme önerisi ver (neyi azalt, neyle değiştir, öğün sırası gibi).
- Veri azsa dürüstçe "henüz az veri var, eğilim şu yönde" de; kesin konuşma.
Kısa başlıklar + kısa maddeler kullan, okunaklı yaz. ÇOK ÖNEMLİ: Bu tıbbi teşhis değildir; ilaç/doz önerme; kesin değerlendirme için doktora danışmasını mutlaka belirt. ${ctx.join(' ')}${healthText(health)}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      system,
      messages: [
        {
          role: 'user',
          content: `İşte şeker ölçümlerim ve öncesinde yediklerim (kronolojik). Örüntüleri bul, bana özel değerlendir:\n\n${pairsText}`
        }
      ]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Analiz üretilemedi.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// ANLIK tok-seker notu: kullanici bir TOK seker olcumu girdiginde, hemen
// oncesindeki ogunle iliskisini KISA (1-2 cumle) yorumlar. 3 olcum birikmesini
// beklemeden aninda geri bildirim. Kucuk token.
export async function quickMealSugarNote(opts: {
  apiKey: string
  sugar: number
  context?: string // aç / tok
  time: string
  meal: string // "yemek adı (~kcal)" (birden fazla olabilir)
  minutesAfter?: number // ogunden kac dk sonra olculdu
  model?: string
  health?: string
}): Promise<string> {
  const { apiKey, sugar, context, time, meal, minutesAfter, model = DEFAULT_MODEL, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const after = minutesAfter ? ` (öğünden ~${minutesAfter} dk sonra)` : ''
  const system = `Sen bir klinik diyetisyen/sağlık asistanısın. Kullanıcı SON yediği öğünden sonra bir KAN ŞEKERİ ölçtü. Görevin, bu ÖLÇÜMÜN o ÖĞÜNLE ilişkisini KISA (en fazla 2 cümle) ve KİŞİYE ÖZEL yorumlamak:
- Bu değer bu öğün için iyi mi, yüksek mi? Öğündeki hangi bileşen (nişasta/şeker/porsiyon) etkilemiş olabilir?
- Somut, uygulanabilir tek bir mini öneri ver (örn. "bir dahaki sefere pilavı yarıya indir / yanına protein ekle").
Kişinin sağlık verisi verildiyse (ilaç/rahatsızlık/eğilim) onu da dikkate al. ÇOK ÖNEMLİ: Tıbbi teşhis değildir; endişe verecek bir durumda doktora danışmasını hatırlat. Türkçe, sıcak ve kısa yaz.${healthText(health)}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 300,
      system,
      messages: [
        {
          role: 'user',
          content: `Saat ${time}'te kan şekerim ${sugar} mg/dL${context ? ` (${context})` : ''} çıktı${after}. Öncesinde şunları yemiştim: ${meal}. Bu öğünle ilişkisini kısaca yorumla.`
        }
      ]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Not üretilemedi.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// SAGLIK CHECK-UP sohbeti: kullanicinin TUM saglik verilerini (tahliller,
// seker/tansiyon, kilo/olcu egilimi, ilac, rahatsizlik) bir arada, bir hekim
// check-up yapiyormus gibi degerlendirir; kullanici serbestce soru sorabilir.
export async function healthChat(opts: {
  apiKey: string
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  medications?: string
  conditions?: string
  body?: string // boy/yas/cinsiyet/kilo
  labsText?: string // tahlillerin tam metni (baslik+tarih+deger/yorum)
  vitalsText?: string // son seker/tansiyon dokumu
  health?: string // ortak saglik baglami (egilimler + ozet)
  dietitianNotes?: string
}): Promise<string> {
  const { apiKey, history, model = DEFAULT_MODEL, userName, goal, medications, conditions, body, labsText, vitalsText, health, dietitianNotes } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!history.length) throw new Error('Bir şey yaz.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (body) ctx.push(body)
  if (goal) ctx.push(`Diyet hedefi: ${goal}.`)
  if (conditions?.trim()) ctx.push(`Kronik rahatsızlıklar: ${conditions.trim()}.`)
  if (medications?.trim()) ctx.push(`Kullandığı ilaçlar: ${medications.trim()}.`)

  const system = `Sen deneyimli bir HEKİM/KLİNİK UZMAN gibi konuşan bir sağlık asistanısın. Kullanıcının ELİNDEKİ TÜM sağlık verilerini (tahliller, kan şekeri, tansiyon, kilo/ölçü eğilimi, ilaçlar, rahatsızlıklar, diyet uyumu) BİR ARADA, sanki ona bir CHECK-UP yapıyormuşsun gibi bütünsel değerlendir.

Nasıl konuşursun:
- Değerleri TEK TEK değil, BİRBİRİYLE İLİŞKİLİ oku. Bağlantı kur: örn. "CRP'n yüksek + kan şekerin yüksek + kilo fazlan var → bunlar düşük dereceli iltihap/insülin direnci tablosuna işaret edebilir."
- Neyin iyi, neyin sınırda, neyin dikkat gerektirdiğini SADE dille söyle; zamanla nasıl değiştiğine (eğilim) değin.
- İlaç-besin/etkileşim ve rahatsızlıklarla bağlantılı uyarılar ver.
- Somut, uygulanabilir öneriler sun (beslenme, yaşam tarzı).
- Kullanıcı serbestçe soru sorarsa (örn. "CRP'm neden yüksek?") o soruya odaklı, net cevap ver.
- Emin olmadığında dürüst ol; eldeki veri azsa "şunu da ölçtürürsen daha net konuşurum" de.
ÇOK ÖNEMLİ: Sen TEŞHİS KOYMAZSIN ve tedavi/ilaç değiştirmezsin. "Şu bulgular şuna işaret EDEBİLİR, kesin değerlendirme için doktoruna/eczacına danış" çerçevesinde konuş. Riskli/acil bir değer varsa açıkça vurgula ve doktora başvurmasını söyle. Türkçe, güven veren, anlaşılır ve gereksiz uzun olmayan cevaplar ver. ${ctx.join(' ')}${dietitianText(dietitianNotes)}

TAHLİLLER:
${labsText?.trim() || '(kayıtlı tahlil yok — kullanıcı Tahliller bölümünden ekleyebilir)'}

SON ŞEKER / TANSİYON:
${vitalsText?.trim() || '(kayıt yok)'}${healthText(health)}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1200,
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
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, data, days, model = DEFAULT_MODEL, userName, goal, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları (değerlendirmede dikkate al): ${dietitianNotes.trim()}.`)

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
      messages: [{ role: 'user', content: `Son ${days} günün verileri:\n\n${data}${healthText(health)}\n\nBunları değerlendir.` }]
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

// Samsung Health / akilli saat ekran goruntusunden aktivite verilerini okur.
// Ne varsa cikarir; gorunmeyeni null birakir. SADECE ilgili sayilar.
export interface ActivityScan {
  steps?: number | null // adim
  kcal?: number | null // yakilan kalori
  avgHr?: number | null // ortalama nabiz (bpm)
  cadence?: number | null // tempo (adim/dk)
  distanceKm?: number | null // mesafe (km)
  minutes?: number | null // sure (dk)
  activityName?: string | null // orn. "Yürüyüş"
}
export async function extractActivityFromPhoto(opts: { apiKey: string; dataUrl: string; model?: string }): Promise<ActivityScan> {
  const { apiKey, dataUrl, model = DEFAULT_MODEL } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  const block = mediaBlock(dataUrl)
  if (!block) throw new Error('Dosya okunamadı (yalnızca görsel).')

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 400,
      system:
        'Sen bir Samsung Health / akıllı saat ekran görüntüsü okuyucususun. Görseldeki sayısal değerleri çıkar ve SADECE geçerli JSON döndür (başka hiçbir metin yok): ' +
        '{"steps":number|null,"kcal":number|null,"avgHr":number|null,"cadence":number|null,"distanceKm":number|null,"minutes":number|null,"activityName":string|null}. ' +
        'Kurallar: Görünmeyen alanı null yap. Sayılardaki nokta binlik ayırıcıdır ("7.360" -> 7360). Ondalık için virgül olabilir ("4,2" -> 4.2). ' +
        'Süre "SS:DD" ya da "SS:DD:ss" biçimindeyse toplam DAKİKAya çevir (ör. "53:06" -> 53, "1:05:00" -> 65). ' +
        'kcal = yakılan kalori ("kal"). avgHr = ortalama kalp atışı/nabız (bpm). cadence = adım/dk. activityName = etkinlik adı (yoksa null). Uydurma yapma.',
      messages: [
        {
          role: 'user',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [block as any, { type: 'text', text: 'Bu ekran görüntüsündeki değerleri JSON olarak çıkar.' }]
        }
      ]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi. Farklı bir görsel deneyin.')
    const raw = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    // Yanit metinle sarilmis olabilir; ilk {...} blogunu ayikla
    const jsonStr = cleaned.startsWith('{') ? cleaned : (cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned)
    const obj = JSON.parse(jsonStr) as ActivityScan
    // Sadece anlamli sayilari birak (0/negatif/NaN -> undefined)
    const pos = (n: unknown) => (typeof n === 'number' && isFinite(n) && n > 0 ? n : undefined)
    return {
      steps: pos(obj.steps),
      kcal: pos(obj.kcal),
      avgHr: pos(obj.avgHr),
      cadence: pos(obj.cadence),
      distanceKm: pos(obj.distanceKm),
      minutes: pos(obj.minutes),
      activityName: typeof obj.activityName === 'string' && obj.activityName.trim() ? obj.activityName.trim() : undefined
    }
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
  body?: string // boy/yas/cinsiyet/kilo
  medications?: string // kullanilan ilaclar
  conditions?: string // kronik rahatsizliklar
  vitals?: string // son seker/tansiyon ozeti
  health?: string // ortak saglik baglami (olcu egilimleri, uyum vb.)
}): Promise<string> {
  const { apiKey, labsText, model = DEFAULT_MODEL, userName, goal, body, medications, conditions, vitals, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (body) ctx.push(body)
  if (conditions?.trim()) ctx.push(`Kronik rahatsızlıklar: ${conditions.trim()}.`)
  if (medications?.trim()) ctx.push(`Kullandığı ilaçlar: ${medications.trim()}.`)
  if (goal) ctx.push(`Diyet hedefi: ${goal}.`)

  const extra: string[] = []
  if (vitals?.trim()) extra.push(`\n\nSON ŞEKER/TANSİYON ÖLÇÜMLERİ:\n${vitals.trim()}`)

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2200,
      system: `Sen bir sağlık asistanısın. Kullanıcının TÜM sağlık verilerini BİRLİKTE değerlendir: tahlil sonuçları, şeker/tansiyon ölçümleri, kullandığı ilaçlar, kronik rahatsızlıkları ve diyet hedefi. Sade, anlaşılır Türkçe ile:
- Hangi değerler normal/yüksek/düşük, zamanla nasıl değişmiş.
- İlaçları ve rahatsızlıklarıyla BAĞLANTILI dikkat noktaları ve UYARILAR ver (örn. "şekerin yüksek ve X ilacı kullanıyorsun, şu belirtilere dikkat et / şu besinlerden kaçın"). İlaç-besin etkileşimi olası ise nazikçe belirt.
- Diyet/beslenme açısından somut öneriler sun (bu verilerin ışığında).
- Acil/riskli bir değer varsa vurgula ve doktora başvurmasını öner.
ÇOK ÖNEMLİ: Bu tıbbi teşhis veya tedavi değildir; ilaç değişikliği önerme; kesin değerlendirme için doktora/eczacıya danışması gerektiğini MUTLAKA belirt. ${ctx.join(' ')}${healthText(health)}`,
      messages: [
        {
          role: 'user',
          content: `İşte sağlık verilerim. Tahlillerimi, ölçümlerimi ve ilaçlarımı birlikte değerlendir; uyarılarda bulun ve diyetim için öneri ver:\n\nTAHLİLLER (tarih sırasıyla):\n${labsText}${extra.join('')}`
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

// "BENI TANI" PROFILI: ortak akil (health) baglamindan, kullaniciyi TANIYAN
// kalici bir ozet cikarir. Bir kez uretilir, tum modullere temel olur.
export async function buildPersonalProfile(opts: {
  apiKey: string
  health: string
  model?: string
  userName?: string
  goal?: string
  dietitianNotes?: string
}): Promise<string> {
  const { apiKey, health, model = DEFAULT_MODEL, userName, goal, dietitianNotes } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları: ${dietitianNotes.trim()}.`)

  const system = `Sen "Diyet Koçu"nun hafızasısın. Aşağıdaki verilerden kullanıcıyı TANIYAN, kalıcı bir "kişisel profil" çıkar. Bu profil daha sonra tüm modüllere temel olacak; bu yüzden ÖZ, NET ve İŞE YARAR olmalı.
Şu başlıklarda, KISA maddeler halinde yaz (veri yoksa o başlığı atla, uydurma):
• Açlık/tokluk örüntüsü (hangi saatlerde acıkıyor, hangi öğün doyurmuyor)
• Kan şekeri tepkileri (hangi yemek yükseltiyor/iyi geliyor)
• Moral/enerji örüntüsü (varsa yemekle ilişkisi)
• Kriz/tatlı isteği saatleri
• İlaç düzeni (öğünle ilişkisi)
• Alışkanlıklar/tercihler ve kaçındıkları
• Kilo/ölçü gidişatı (kısaca)
En sona "KOÇA NOT:" başlığıyla, gelecekteki önerilerde dikkat edilecek 2-3 kişisel kuralı yaz (örn. "kahvesi şekersiz", "16:00'da ara öğün öner"). Türkçe, madde işaretli, abartısız. Toplam en fazla ~200 kelime. ${ctx.join(' ')}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: `Verilerim:\n\n${health}\n\nBeni tanıyan kişisel profili çıkar.` }]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Profil üretilemedi. Lütfen tekrar deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// HAFTALIK ICGORU: son 7 gunun verilerinden 3-5 kisisel cikarim + bu haftanin
// odagini uretir (proaktif kocluk). health = ortak akil baglami.
export async function weeklyInsights(opts: {
  apiKey: string
  health: string
  model?: string
  userName?: string
  goal?: string
  dietitianNotes?: string
}): Promise<string> {
  const { apiKey, health, model = DEFAULT_MODEL, userName, goal, dietitianNotes } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  if (dietitianNotes?.trim()) ctx.push(`Diyetisyenin talimatları (dikkate al): ${dietitianNotes.trim()}.`)

  const system = `Sen "Diyet Koçu"sun. Kullanıcının verilerine bakıp KİŞİSEL bir haftalık içgörü raporu yaz. Format:
1) "📌 Bu hafta seninle ilgili fark ettiklerim" başlığı altında 3-5 madde — her biri SOMUT ve kişisel (sayı/saat/yemek adıyla). Örn. "Öğle öğünlerinde tokluğun düşük (ort. 4/10), bu yüzden ikindi krizine giriyorsun."
2) "📈 İlerleme/gerileme" başlığı altında: kilo/ölçü/tahlil gidişatını NEDENLERİYLE bağla — YEDİKLERİ + aldığı VİTAMİN/TAKVİYE + İLAÇLARI (etken maddeleriyle) birlikte değerlendir. Örn. "Kilon 2 hafta düştü; omega-3 ve protein ağırlıklı öğünler + düzenli D vitamini bunu destekliyor" ya da "hafta sonu şekerli atıştırmalar ilerlemeyi yavaşlatmış". Elde veri varsa mutlaka bu bağı kur.
3) "🎯 Bu haftanın odağı" başlığı altında 1 net, ulaşılabilir hedef.
Genel geçer öğüt VERME; sadece ELDEKİ veriden çıkanı söyle. İlaç/vitamin etken madde bilgisi verildiyse yorumda kullan ama TEŞHİS/DOZ TAVSİYESİ verme. Veri azsa dürüst ol ("henüz örüntü çıkacak kadar veri yok, şunları girmeye devam et"). Türkçe, güçlendirici, kısa. ${ctx.join(' ')}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: `Verilerim:\n\n${health}\n\nBu haftanın kişisel içgörüsünü çıkar.` }]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('İçgörü üretilemedi. Lütfen tekrar deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// İLAÇ/VİTAMİN UYUM YORUMU: hesaplanan kullanım özetine bakıp kısa, net bir
// değerlendirme + düzeni artırma önerisi verir. Teşhis/tedavi vermez.
export async function medComment(opts: {
  apiKey: string
  summary: string
  model?: string
  userName?: string
  conditions?: string
  health?: string
}): Promise<string> {
  const { apiKey, summary, model = DEFAULT_MODEL, userName, conditions, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (conditions?.trim()) ctx.push(`Rahatsızlıkları: ${conditions.trim()}.`)

  const system = `Sen bir sağlık asistanısın. Kullanıcının İLAÇ/VİTAMİN kullanım UYUM verileri aşağıda. KISA (3-6 cümle), sıcak ve NET bir değerlendirme yaz:
- Hangilerini düzenli almış, hangilerini aksatmış (yüzdelere değin).
- Öğünle ilişkisi (aç/tok) varsa ona kısaca değin.
- Düzeni artırmak için 1-2 SOMUT, uygulanabilir öneri (saat, hatırlatıcı, öğüne bağlama).
ÇOK ÖNEMLİ: Teşhis KOYMA, ilaç/doz DEĞİŞTİRME; gerektiğinde doktor/eczacıya danışmasını söyle. Türkçe, güçlendirici, suçlayıcı olmadan. ${ctx.join(' ')}`

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: `${summary}${healthText(health)}\n\nBu ilaç/vitamin kullanım uyumunu değerlendir.` }]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Yorum üretilemedi. Lütfen tekrar deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// YEMEK NETLEŞTİRME SOHBETİ: fotoğrafı inceler, ne gördüğünü söyler ve kalori/
// makro için emin olamadıklarını kullanıcıya SORAR. Henüz sayı vermez; kullanıcı
// cevapladıkça netleştirir. Foto yalnızca ilk turda gönderilir (token tasarrufu);
// sonraki turlar metinden devam eder (ilk açıklama geçmişte kalır).
export async function mealClarifyChat(opts: {
  apiKey: string
  photoDataUrl?: string
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, photoDataUrl, history, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  const planText = dietPlan?.trim() ? `\n\nDİYET LİSTESİ (bağlam): ${dietPlan.trim()}` : ''

  const system = `Sen "Diyet Koçu"sun. Kullanıcı bir yemek fotoğrafı çekti. GÖREVİN: fotoğrafı incele, ne gördüğünü KISACA söyle, sonra kalori/makro tahmininde EMİN OLAMADIĞIN veya yanlış yapabileceğin şeyleri kullanıcıya SOR ve birlikte netleştir.
Kurallar:
- Aynı anda en fazla 2-3 KISA soru sor (porsiyon/gramaj, pişirme yağı/tereyağı, şeker/tatlandırıcı, sos, görünmeyen malzemeler, içecek şekerli mi vb.).
- "Tamamını mı yedin?" diye SORMA — VARSAYILAN: tabağın TAMAMI yenmiştir. Kullanıcı kendisi "yarısını yedim / birazını bıraktım" derse o zaman yenen miktara göre hesapla; söylemezse hepsini yemiş say ve bu konuyu hiç açma.
- HENÜZ kalori/makro/puan VERME; önce yeterince netleştir.
- Kullanıcı cevapladıkça kısaca "anladım" diye teyit et; belirsizlik sürüyorsa 1-2 soru daha sor.
- Yeterince netleştiğinde şunu yaz: "Netleşti 👍 Hazırsan aşağıdan 'Onayla ve hesapla'ya bas."
- Kullanıcının söylediğini varsayma, sor; ama gereksiz uzatma. Kısa, samimi, Türkçe. ${ctx.join(' ')}${dietitianText(dietitianNotes)}${planText}${healthText(health)}`

  const img = photoDataUrl && history.length === 0 ? splitDataUrl(photoDataUrl) : null
  const firstContent = [
    ...(img ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType as 'image/jpeg', data: img.base64 } }] : []),
    { type: 'text' as const, text: 'Bu yemeği çektim. Fotoğrafa bak; ne gördüğünü söyle ve kalori/makro için netleştirmen gerekenleri bana sor. Henüz sayı verme.' }
  ]
  const messages = [
    { role: 'user' as const, content: firstContent },
    ...history.map((m) => ({ role: m.role, content: m.text }))
  ]

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({ model, max_tokens: 700, system, messages })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Cevap üretilemedi. Lütfen tekrar deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// NE YESEM ÜRÜN NETLEŞTİRME: masadaki/eldeki ürünlerin fotoğraflarına bakar,
// gördüğü ürünleri LİSTELER ve kullanıcıya "doğru mu, eksik/yanlış var mı?" diye
// sorar. Öneri VERMEZ; önce ürün listesi kesinleşir. Fotoğraflar yalnızca ilk
// turda gönderilir (token tasarrufu). Sonuç: netleşen ürün listesi suggestMeal'e
// note olarak verilir.
export async function pantryClarifyChat(opts: {
  apiKey: string
  photoDataUrls?: string[]
  history: { role: 'user' | 'assistant'; text: string }[]
  model?: string
  userName?: string
  goal?: string
  dietPlan?: string
  dietitianNotes?: string
  health?: string
}): Promise<string> {
  const { apiKey, photoDataUrls, history, model = DEFAULT_MODEL, userName, goal, dietPlan, dietitianNotes, health } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')

  const ctx: string[] = []
  if (userName) ctx.push(`Kullanıcı: ${userName}.`)
  if (goal) ctx.push(`Hedef: ${goal}.`)
  const planText = dietPlan?.trim() ? `\n\nDİYET LİSTESİ (bağlam): ${dietPlan.trim()}` : ''

  const system = `Sen "Diyet Koçu"sun. Kullanıcı elindeki/masadaki yemek ve ürünlerin fotoğraflarını çekti; birazdan ona ne yiyeceğini önereceksin. AMA ÖNCE elimizde tam olarak NELER VAR onu netleştir. GÖREVİN: fotoğraflardaki ürünleri KISA bir liste halinde say ("Şunları görüyorum: …") ve kullanıcıya sor: "Doğru mu? Yanlış tanıdığım, eksik ya da fotoğrafta olmayan bir şey var mı? Eklemek istediğin ürün var mı?".
Kurallar:
- HENÜZ öneri/gramaj/kalori VERME. Önce ürün listesini kesinleştir.
- Ürünleri sorarken bir de PORSİYON BİRİMİ tercihini sor: "Porsiyonları nasıl vereyim — gram mı, yoksa çorba/tatlı/çay kaşığı, su bardağı gibi ev ölçüsü mü? İstersen bazıları gram bazıları ölçü olabilir." Kullanıcının tercihini not al (öneri aşamasında buna uyulacak).
- Kullanıcı düzeltince güncel listeyi kısaca teyit et; hâlâ belirsizse tek bir soru daha sor.
- Liste netleşince şunu yaz: "Liste net 👍 Hazırsan 'Öner'e bas."
- Kısa, samimi, Türkçe. ${ctx.join(' ')}${dietitianText(dietitianNotes)}${planText}${healthText(health)}`

  const sources = photoDataUrls?.length && history.length === 0 ? photoDataUrls : []
  const imgs = sources.map((u) => splitDataUrl(u)).filter((v): v is NonNullable<typeof v> => !!v)
  const firstContent = [
    ...imgs.map((img) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mediaType as 'image/jpeg', data: img.base64 }
    })),
    { type: 'text' as const, text: 'Bu ürünleri/masayı çektim. Ne gördüğünü listele ve doğrulamam için sor. Henüz öneri verme.' }
  ]
  const messages = [
    { role: 'user' as const, content: firstContent },
    ...history.map((m) => ({ role: m.role, content: m.text }))
  ]

  const client = await createClient(apiKey)
  try {
    const response = await client.messages.create({ model, max_tokens: 700, system, messages })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Cevap üretilemedi. Lütfen tekrar deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}

// İLAÇ/VİTAMİN ETKEN MADDE ANALİZİ: adı (+doz) verilen ürünün etken maddelerini,
// ne işe yaradığını, ilgili tahlil/belirtileri ve dikkat edilecekleri KISA, yapılandırılmış
// çıkarır. Bu metin "ortak sağlık bağlamına" eklenir; böylece ilerleme/gerileme
// yorumlarında yediklerle+ilaçlarla birlikte kullanılır. TEŞHİS/TEDAVİ DEĞİLDİR.
export async function analyzeMedIngredients(opts: {
  apiKey: string
  name: string
  kind?: 'ilac' | 'vitamin'
  dose?: string
  brand?: string
  model?: string
}): Promise<string> {
  const { apiKey, name, kind, dose, brand, model = DEFAULT_MODEL } = opts
  if (!apiKey) throw new Error('Önce Ayarlar bölümünden API anahtarınızı girin.')
  if (!name.trim()) throw new Error('Önce ilaç/vitamin adını gir.')

  const system = `Sen bir eczacı/beslenme asistanısın. Sana bir ilaç ya da takviye/vitamin adı, MARKASI (ve varsa dozu) verilecek. KISA, yapılandırılmış ve GENEL bilgi ver. MARKA ÖNEMLİ: aynı isimli ürünün farklı markalarında etken madde/oran/ek bileşenler DEĞİŞEBİLİR; verilen markaya GÖRE değerlendir. Şu başlıklarla, madde işaretli yaz (o markanın kesin formülünü bilmiyorsan UYDURMA, "bu marka için net değil, kutudaki içeriğe bak" de):
• Etken madde(ler): (ör. Omega-3 EPA/DHA; kolekalsiferol D3; menakinon K2…)
• Ne işe yarar: (1-2 kısa madde)
• İlgili tahlil/belirti: (hangi kan değeri/şikâyetle ilişkili — ör. D vitamini düzeyi, lipid profili)
• Beslenmeyle ilişkisi: (aç/tok, yağla emilim, hangi besinlerle desteklenir)
• Dikkat/etkileşim: (varsa genel uyarı)
ÇOK ÖNEMLİ: Bu bir bilgilendirmedir, TEŞHİS/TEDAVİ/DOZ TAVSİYESİ DEĞİLDİR; doz ve etkileşim için doktor/eczacıya danışılmalı. Türkçe, abartısız, toplam ~120 kelime.`

  const client = await createClient(apiKey)
  const label = `${brand?.trim() ? `Marka: ${brand.trim()} — ` : ''}${name.trim()}${dose?.trim() ? ` (${dose.trim()})` : ''}${kind === 'vitamin' ? ' — vitamin/takviye' : ''}`
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: `Ürün: ${label}\n\nEtken madde analizini çıkar.` }]
    })
    if (response.stop_reason === 'refusal') throw new Error('İstek reddedildi.')
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) throw new Error('Analiz üretilemedi. Lütfen tekrar deneyin.')
    return text
  } catch (err) {
    throw friendlyError(err)
  }
}
