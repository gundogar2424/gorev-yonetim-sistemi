// YAPAY ZEKA ILE TARIF AYIKLAMA (istege bagli).
//
// Sosyal medya aciklamalari daginik olur (emoji, hashtag, "tarif yorumlarda"...).
// API anahtari girildiyse metin secili yapay zekaya (Claude ya da Gemini) gonderilir ve duzenli bir tarif
// (baslik, malzemeler, adimlar, sure, porsiyon, etiketler) olarak geri alinir.
// Anahtar YALNIZCA bu cihazda (localStorage) saklanir, yedege yazilmaz.
import type { LzDraft } from '../types'

// Iki saglayici: Claude (ucretli, kullandikca) ve Google Gemini (gunluk
// ucretsiz kullanim hakki var; ayrica videoyu dogrudan izleyip dinleyebilir).
export type Saglayici = 'claude' | 'gemini'
const KEY_SAGLAYICI = 'lz-saglayici'
const KEY_ANAHTAR: Record<Saglayici, string> = { claude: 'lz-api-key', gemini: 'lz-gemini-key' }
const KEY_MODEL: Record<Saglayici, string> = { claude: 'lz-model', gemini: 'lz-gemini-model' }
export const VARSAYILAN_MODEL: Record<Saglayici, string> = { claude: 'claude-sonnet-5', gemini: 'gemini-flash-latest' }

function oku(k: string): string {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
function yaz(k: string, v: string): void {
  try {
    if (v) localStorage.setItem(k, v)
    else localStorage.removeItem(k)
  } catch {
    /* yok say */
  }
}

export function saglayici(): Saglayici {
  const v = oku(KEY_SAGLAYICI)
  if (v === 'claude' || v === 'gemini') return v
  // Eski kurulumda Claude anahtari varsa Claude, yoksa ucretsiz Gemini
  return oku(KEY_ANAHTAR.claude) ? 'claude' : 'gemini'
}
export function saglayiciKaydet(v: Saglayici): void {
  yaz(KEY_SAGLAYICI, v)
}
export function anahtarOku(s: Saglayici): string {
  return oku(KEY_ANAHTAR[s])
}
export function anahtarKaydet(s: Saglayici, v: string): void {
  yaz(KEY_ANAHTAR[s], v.trim())
}
export function modelOku(s: Saglayici): string {
  return oku(KEY_MODEL[s]) || VARSAYILAN_MODEL[s]
}
export function modelYaz(s: Saglayici, v: string): void {
  yaz(KEY_MODEL[s], v.trim() && v.trim() !== VARSAYILAN_MODEL[s] ? v.trim() : '')
}

// Secili saglayicinin anahtari (bos = yapay zeka kapali)
export function apiAnahtari(): string {
  return anahtarOku(saglayici())
}
export function modelAdi(): string {
  return modelOku(saglayici())
}
export function aiAdi(): string {
  return saglayici() === 'gemini' ? 'Gemini' : 'Claude'
}

export const ETIKETLER = [
  'Kahvaltılık',
  'Çorba',
  'Ana Yemek',
  'Akşam Yemeği',
  'Zeytinyağlı',
  'Salata',
  'Hamur İşi',
  'Tatlı',
  'Aperatif',
  'İçecek',
  'Pratik',
  'Sağlıklı'
]

const SEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_recipe', 'title', 'servings', 'minutes', 'ingredients', 'steps', 'notes', 'tags'],
  properties: {
    is_recipe: { type: 'boolean', description: 'Metinde gerçekten bir yemek tarifi var mı' },
    title: { type: 'string', description: 'Kısa, doğal Türkçe tarif adı (emoji/hashtag yok)' },
    servings: { type: 'integer', description: 'Kaç kişilik; belirtilmemişse 0' },
    minutes: { type: 'integer', description: 'Toplam hazırlık+pişirme süresi (dk); belirtilmemişse makul tahmin, bilinmiyorsa 0' },
    ingredients: {
      type: 'array',
      items: { type: 'string' },
      description: 'Her malzeme ayrı satır, miktar başta: "2 su bardağı un"'
    },
    steps: { type: 'array', items: { type: 'string' }, description: 'Yapılış adımları, her biri tek kısa paragraf' },
    notes: { type: 'string', description: 'Püf noktaları / servis önerisi; yoksa boş' },
    tags: { type: 'array', items: { type: 'string', enum: ETIKETLER }, description: 'En fazla 3 uygun etiket' }
  }
}

// Icerik parcalari saglayicidan bagimsiz tutulur, gonderirken cevrilir.
export type Parca =
  | { type: 'text'; text: string }
  | { type: 'image'; mime: string; data: string } // base64
  | { type: 'video'; mime: string; data: string } // yalnizca Gemini
  | { type: 'youtube'; url: string } // yalnizca Gemini

function hataMetni(status: number, govde: string): string {
  const ad = aiAdi()
  if (status === 400 && /API key|API_KEY/i.test(govde)) return `${ad} API anahtarı geçersiz. Ayarlar’dan kontrol et.`
  if (status === 401) return `${ad} API anahtarı reddedildi. Ayarlar’dan kontrol et.`
  if (status === 403) return `${ad} anahtarının bu modele erişimi yok ya da bakiye yetersiz.`
  if (status === 404) return `Model bulunamadı (${modelAdi()}). Ayarlar’dan modeli değiştir.`
  if (status === 429)
    return saglayici() === 'gemini'
      ? 'Gemini’nin ücretsiz kullanım sınırına ulaşıldı; bir dakika ya da yarına kadar bekle (ya da Ayarlar’dan Claude’a geç).'
      : 'Şu an istek sınırındasın; birazdan tekrar dene.'
  if (status === 529 || status >= 500) return `${ad} şu an yoğun; birazdan tekrar dene.`
  return `İstek reddedildi (${status}). ${govde.slice(0, 160)}`
}

async function gonder(url: string, headers: Record<string, string>, body: unknown): Promise<{ status: number; ok: boolean; govde: string }> {
  let r: Response
  try {
    r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  } catch {
    throw new Error('Yapay zekaya bağlanılamadı. İnternet bağlantını kontrol et.')
  }
  return { status: r.status, ok: r.ok, govde: await r.text() }
}

function jsonCoz<T>(text: string, kesildi: boolean): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t) as T
  } catch {
    throw new Error(kesildi ? 'Yanıt çok uzun, yarıda kesildi.' : 'Yapay zeka yanıtı okunamadı.')
  }
}

async function claudeCagri<T>(system: string, parcalar: Parca[], schema: object, maxTokens: number): Promise<T> {
  const content = parcalar
    .map((p) =>
      p.type === 'text'
        ? { type: 'text', text: p.text }
        : p.type === 'image'
          ? { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } }
          : null
    )
    .filter(Boolean)
  const r = await gonder(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': apiAnahtari(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    {
      model: modelAdi(),
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content }]
    }
  )
  if (!r.ok) throw new Error(hataMetni(r.status, r.govde))
  let json: { content?: { type: string; text?: string }[]; stop_reason?: string }
  try {
    json = JSON.parse(r.govde)
  } catch {
    throw new Error('Yapay zekadan anlaşılmayan bir yanıt geldi.')
  }
  return jsonCoz<T>(json.content?.find((c) => c.type === 'text')?.text ?? '', json.stop_reason === 'max_tokens')
}

const GEMINI_KOK = 'https://generativelanguage.googleapis.com/v1beta'
const KEY_GEMINI_OTO = 'lz-gemini-model-oto'

function anahtarHatasi(r: { status: number; govde: string }): boolean {
  return (r.status === 400 || r.status === 401 || r.status === 403) && /API key|API_KEY|UNAUTHENTICATED|PERMISSION_DENIED|credential/i.test(r.govde)
}

// Anahtar once basliktan (x-goog-api-key) gonderilir; reddedilirse adresin
// sonunda (?key=) denenir. Google'in yeni "AQ." bicimli anahtarlari ile eski
// "AIza" anahtarlari ikisinden birinde mutlaka kabul edilir.
async function geminiGonder(yol: string, body: unknown): Promise<{ status: number; ok: boolean; govde: string }> {
  const anahtar = apiAnahtari()
  let r = await gonder(`${GEMINI_KOK}/${yol}`, { 'x-goog-api-key': anahtar }, body)
  if (anahtarHatasi(r)) {
    const r2 = await gonder(`${GEMINI_KOK}/${yol}${yol.includes('?') ? '&' : '?'}key=${encodeURIComponent(anahtar)}`, {}, body)
    if (!anahtarHatasi(r2)) r = r2
  }
  return r
}

// Secilen model bu anahtarla yoksa (404) anahtarin erisebildigi modeller
// listelenir ve en yeni "flash" modeli kendiliginden secilir.
async function geminiModelBul(): Promise<string> {
  const anahtar = apiAnahtari()
  const dene = async (h: Record<string, string>, q: string) => {
    try {
      const r = await fetch(`${GEMINI_KOK}/models?pageSize=200${q}`, { headers: h })
      return r.ok ? ((await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }) : null
    } catch {
      return null
    }
  }
  const j = (await dene({ 'x-goog-api-key': anahtar }, '')) ?? (await dene({}, `&key=${encodeURIComponent(anahtar)}`))
  const adlar = (j?.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/lite|image|tts|audio|live|embedding|thinking-exp/.test(n))
  const surum = (n: string) => Number(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  adlar.sort((x, y) => surum(y) - surum(x) || Number(/preview|exp/.test(x)) - Number(/preview|exp/.test(y)))
  return adlar[0] ?? ''
}

async function geminiCagri<T>(system: string, parcalar: Parca[], schema: object, maxTokens: number): Promise<T> {
  const parts = parcalar.map((p) =>
    p.type === 'text'
      ? { text: p.text }
      : p.type === 'youtube'
        ? { file_data: { file_uri: p.url, mime_type: 'video/*' } }
        : { inline_data: { mime_type: p.mime, data: p.data } }
  )
  const govde = (semaIle: boolean) => ({
    system_instruction: { parts: [{ text: semaIle ? system : `${system}\n\nYanıtı YALNIZCA şu JSON şemasına uyan tek bir JSON nesnesi olarak ver:\n${JSON.stringify(schema)}` }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      // Yeni Gemini modelleri cevaptan once "dusunur" ve bu da bu tavandan yer;
      // dar tavan cevabi yarida keser. Bu yuzden genis tutulur.
      maxOutputTokens: Math.max(maxTokens * 4, 8192),
      responseMimeType: 'application/json',
      ...(semaIle ? { responseJsonSchema: schema } : {})
    }
  })

  let model = oku(KEY_GEMINI_OTO) && !oku(KEY_MODEL.gemini) ? oku(KEY_GEMINI_OTO) : modelAdi()
  const cagir = (semaIle: boolean) => geminiGonder(`models/${encodeURIComponent(model)}:generateContent`, govde(semaIle))
  let r = await cagir(true)
  if (r.status === 404) {
    const bulunan = await geminiModelBul()
    if (bulunan && bulunan !== model) {
      model = bulunan
      yaz(KEY_GEMINI_OTO, bulunan)
      r = await cagir(true)
    }
  }
  // Sema alanini desteklemeyen bir model secildiyse semayi metinle tarif edip tekrar dene
  if (r.status === 400 && /responseJsonSchema|response_json_schema|schema/i.test(r.govde) && !anahtarHatasi(r)) {
    r = await cagir(false)
  }
  if (!r.ok) {
    let ayrinti = ''
    try {
      ayrinti = (JSON.parse(r.govde) as { error?: { message?: string } }).error?.message ?? ''
    } catch {
      /* yok */
    }
    throw new Error(`${hataMetni(r.status, r.govde)}${ayrinti && r.status !== 429 ? ` [Google: ${ayrinti.slice(0, 140)}]` : ''}`)
  }
  let json: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }
  try {
    json = JSON.parse(r.govde)
  } catch {
    throw new Error('Yapay zekadan anlaşılmayan bir yanıt geldi.')
  }
  const aday = json.candidates?.[0]
  if (!aday) throw new Error(json.promptFeedback?.blockReason ? 'Gemini bu içeriği işlemeyi reddetti.' : 'Gemini boş yanıt verdi.')
  const text = (aday.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('')
  return jsonCoz<T>(text, aday.finishReason === 'MAX_TOKENS')
}

// Hangi Gemini modelinin kullanildigi (Ayarlar'da gosterilir)
export function geminiEtkinModel(): string {
  return oku(KEY_GEMINI_OTO) && !oku(KEY_MODEL.gemini) ? oku(KEY_GEMINI_OTO) : modelOku('gemini')
}

// Yapilandirilmis cagri: secili saglayiciya gider, yanit JSON olarak cozulur.
async function jsonCagri<T>(system: string, content: string | Parca[], schema: object, maxTokens = 4000): Promise<T> {
  if (!apiAnahtari()) throw new Error('Yapay zeka için Ayarlar’dan API anahtarı gir.')
  const parcalar: Parca[] = typeof content === 'string' ? [{ type: 'text', text: content }] : content
  return saglayici() === 'gemini' ? geminiCagri<T>(system, parcalar, schema, maxTokens) : claudeCagri<T>(system, parcalar, schema, maxTokens)
}

interface TarifJson {
  is_recipe: boolean
  title: string
  servings: number
  minutes: number
  ingredients: string[]
  steps: string[]
  notes: string
  tags: string[]
}

function tarifeCevir(v: TarifJson): Partial<LzDraft> {
  if (!v.is_recipe && !v.ingredients?.length) throw new Error('Burada bir tarif bulunamadı.')
  return {
    title: v.title,
    servings: v.servings || 0,
    minutes: v.minutes || 0,
    ingredients: v.ingredients ?? [],
    steps: v.steps ?? [],
    notes: v.notes ?? '',
    tags: (v.tags ?? []).slice(0, 3)
  }
}

const AYIKLA_SISTEM =
  'Sen bir tarif editörüsün. Sosyal medya paylaşımı, web sayfası ya da fotoğraftan gelen dağınık içerikten ' +
  'yemek tarifini çıkarıp düzenli Türkçe tarif olarak döndürürsün. İçerikte olmayan malzeme UYDURMA ve ' +
  'yemeğin adından yola çıkarak "genelde konur" diye malzeme EKLEME; yalnızca içerikte geçenleri yaz. ' +
  'Etin türünü içerikte söylendiği/göründüğü gibi yaz (tavuk göğsü, tavuk kıyması, dana kıyma, kuzu…); ' +
  'tavuğu "kıyma", kıymayı "tavuk" yapma, emin değilsen türü tahmin etme. ' +
  'Miktar yazmıyorsa yalnızca malzeme adını yaz. Emoji, hashtag, "kaydet/beğen/takip et" gibi ' +
  'ifadeleri at. Adımlar yoksa ama malzemeler varsa, malzemelerden anlaşılan yapılışı kısa ' +
  've makul biçimde yaz. İçerik başka dildeyse Türkçeye çevir.'

export async function aiIleAyikla(metin: string, ipucuBaslik = ''): Promise<Partial<LzDraft>> {
  const v = await jsonCagri<TarifJson>(
    AYIKLA_SISTEM,
    `${ipucuBaslik ? `Paylaşım başlığı: ${ipucuBaslik}\n\n` : ''}Metin:\n"""\n${metin.slice(0, 12000)}\n"""`,
    SEMA
  )
  return tarifeCevir(v)
}

// FOTOGRAFTAN TARIF: yemek kitabi sayfasi, el yazisi defter, ekran goruntusu.
export async function aiFotograftan(dataUri: string): Promise<Partial<LzDraft>> {
  const m = dataUri.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
  if (!m) throw new Error('Fotoğraf okunamadı.')
  const v = await jsonCagri<TarifJson>(
    AYIKLA_SISTEM + ' Fotoğraf bir yemek kitabı sayfası, el yazısı tarif ya da ekran görüntüsü olabilir; yazıyı dikkatle oku.',
    [
      { type: 'image', mime: m[1], data: m[2] },
      { type: 'text', text: 'Bu fotoğraftaki tarifi çıkar. Fotoğrafta yalnızca bir yemek görünüyorsa (yazı yoksa), o yemeğin makul bir tarifini yaz.' }
    ],
    SEMA
  )
  return tarifeCevir(v)
}

// VIDEODAN TARIF: aciklama + altyazi + konusma dokumu + ekrandan kareler birlikte.
export interface VideoParcalari {
  baslik: string
  aciklama: string
  altyazi: string // YouTube altyazisi
  konusma: string // Videodaki konusmanin yaziya dokumu (cihazda)
  kareler: string[] // data:image/jpeg;base64,...
  video?: { mime: string; data: string } // Videonun kendisi (yalnizca Gemini; sesi ve goruntuyu birlikte anlar)
  youtube?: string // YouTube adresi (yalnizca Gemini videoyu dogrudan izleyebilir)
}
export async function aiVideodan(p: VideoParcalari): Promise<Partial<LzDraft>> {
  const icerik: Parca[] = []
  const gemini = saglayici() === 'gemini'
  if (gemini && p.video) icerik.push({ type: 'video', mime: p.video.mime, data: p.video.data })
  if (gemini && p.youtube) icerik.push({ type: 'youtube', url: p.youtube })
  for (const k of p.kareler.slice(0, 10)) {
    const m = k.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
    if (m) icerik.push({ type: 'image', mime: m[1], data: m[2] })
  }
  const bolumler = [
    p.baslik && `Paylaşım başlığı: ${p.baslik}`,
    p.aciklama && `Paylaşımın açıklaması:\n"""\n${p.aciklama.slice(0, 8000)}\n"""`,
    p.altyazi && `Videonun altyazısı:\n"""\n${p.altyazi.slice(0, 15000)}\n"""`,
    p.konusma && `Videoda söylenenler (otomatik yazıya çevrildi, hatalı kelimeler olabilir):\n"""\n${p.konusma.slice(0, 15000)}\n"""`,
    gemini && (p.video || p.youtube) && 'Ekteki video tarif videosunun kendisidir: söylenenleri dinle, ekrandaki yazıları ve malzemeleri izle.',
    p.kareler.length && `Yukarıdaki ${Math.min(10, p.kareler.length)} görsel videodan eşit aralıklarla alınmış karelerdir; ekrandaki yazılar (malzeme listesi, ölçüler) ve görünen malzemeler için bunlara bak.`
  ].filter(Boolean)
  icerik.push({
    type: 'text',
    text:
      bolumler.join('\n\n') +
      '\n\nBu kaynakları birleştirerek videodaki tarifi çıkar. Kaynaklar çelişirse videoda söylenen/yazan miktarı esas al. ' +
      'Otomatik yazıya çevirideki bozuk kelimeleri yemek bağlamına göre düzelt (ör. "su bar dağı" → "su bardağı"). ' +
      'ÇOK ÖNEMLİ: Malzemeleri YALNIZCA bu kaynaklarda gördüğün, duyduğun ya da okuduğun bilgilerden yaz. Yemeğin adından ' +
      'yola çıkarak malzeme TAHMİN ETME, benzer bir tarif UYDURMA (ör. başlık "köfte" diye kıyma ekleme). Kaynaklarda malzeme ' +
      'yoksa ingredients listesini boş bırak ve notes alanına "Videoda malzemeler anlaşılamadı." yaz.'
  })
  const v = await jsonCagri<TarifJson>(AYIKLA_SISTEM, icerik, SEMA, 5000)
  return tarifeCevir(v)
}

// NE PISIRSEM: istege / dolaptaki malzemelere gore aileye uygun yeni tarif uretir.
export async function aiTarifUret(istekMetni: string, profil: string): Promise<Partial<LzDraft>> {
  const v = await jsonCagri<TarifJson>(
    'Sen deneyimli, pratik bir Türk ev aşçısısın. Kullanıcının isteğine ya da elindeki malzemelere göre ' +
      'evde kolayca yapılabilecek, lezzetli TEK bir tarif yazarsın. Türkiye marketlerinde bulunan malzemeler ' +
      've Türk mutfağı ölçüleri (su bardağı, yemek kaşığı, gr) kullan. Aile tercihleri verildiyse KESİNLİKLE uy: ' +
      'alerjen ve sevilmeyen malzemeyi kullanma. Notlar kısmına varsa hangi tercihe göre uyarladığını ve püf noktasını yaz. ' +
      'is_recipe her zaman true olsun.',
    `${profil ? `Aile tercihleri:\n${profil}\n\n` : ''}İstek: ${istekMetni}`,
    SEMA
  )
  return tarifeCevir({ ...v, is_recipe: true })
}

// SIHIRLI HAFTALIK MENU: kayitli tarifler arasindan aileye uygun, cesitli bir hafta secer.
export interface MenuSecimi {
  gun: number // 0 = pazartesi
  ogun: 'kahvalti' | 'ogle' | 'aksam'
  tarifId: number
}
export async function aiHaftalikMenu(
  tarifler: { id: number; baslik: string; etiketler: string[]; malzemeler: string }[],
  profil: string,
  ogunler: ('kahvalti' | 'ogle' | 'aksam')[],
  gunler: number[]
): Promise<MenuSecimi[]> {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['plan'],
    properties: {
      plan: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['gun', 'ogun', 'tarif_id'],
          properties: {
            gun: { type: 'integer', description: '0=Pazartesi … 6=Pazar' },
            ogun: { type: 'string', enum: ['kahvalti', 'ogle', 'aksam'] },
            tarif_id: { type: 'integer' }
          }
        }
      }
    }
  }
  const liste = tarifler.map((t) => `#${t.id} ${t.baslik}${t.etiketler.length ? ` [${t.etiketler.join(', ')}]` : ''} — ${t.malzemeler}`).join('\n')
  const v = await jsonCagri<{ plan: { gun: number; ogun: MenuSecimi['ogun']; tarif_id: number }[] }>(
    'Sen bir aile menü planlayıcısısın. YALNIZCA verilen listedeki tarif kimliklerini kullanarak dengeli ve çeşitli ' +
      'bir haftalık menü kurarsın: aynı tarifi art arda koyma, mümkünse haftada bir kereden fazla kullanma, ana malzemeleri ' +
      '(tavuk, kırmızı et, sebze, bakliyat, balık) günlere dağıt. Kahvaltıya kahvaltılık, akşama doyurucu yemek koy. ' +
      'Aile tercihlerine (alerji, sevmedikleri, beslenme biçimi) aykırı tarifi seçme. Uygun tarif yoksa o öğünü boş bırak.',
    `${profil ? `Aile tercihleri:\n${profil}\n\n` : ''}Planlanacak günler: ${gunler.join(', ')}\nÖğünler: ${ogunler.join(', ')}\n\nTarifler:\n${liste}`,
    schema,
    3000
  )
  const gecerli = new Set(tarifler.map((t) => t.id))
  return (v.plan ?? [])
    .filter((p) => gecerli.has(p.tarif_id) && gunler.includes(p.gun) && ogunler.includes(p.ogun))
    .map((p) => ({ gun: p.gun, ogun: p.ogun, tarifId: p.tarif_id }))
}

export async function anahtarTest(): Promise<string> {
  try {
    const v = await jsonCagri<{ ok: boolean }>(
      'Test isteği.',
      'ok alanı true olan JSON döndür.',
      { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
      50
    )
    return v.ok !== undefined
      ? `✓ ${aiAdi()} anahtarı çalışıyor (${saglayici() === 'gemini' ? geminiEtkinModel() : modelAdi()}).`
      : '✗ Beklenmeyen yanıt.'
  } catch (e) {
    return '✗ ' + ((e as Error).message || 'Bağlanılamadı.')
  }
}

// --- Aile profili ------------------------------------------------------------
// Genel beslenme tercihi (Ayarlar) + her sofranin notu (sevmedikleri, alerjileri).
const KEY_PROFIL = 'lz-profil'
export function genelProfil(): string {
  try {
    return localStorage.getItem(KEY_PROFIL) ?? ''
  } catch {
    return ''
  }
}
export function genelProfilKaydet(v: string): void {
  try {
    if (v.trim()) localStorage.setItem(KEY_PROFIL, v.trim())
    else localStorage.removeItem(KEY_PROFIL)
  } catch {
    /* yok say */
  }
}
export function profilMetni(sofralar: { name: string; notes?: string }[]): string {
  const satirlar: string[] = []
  const g = genelProfil()
  if (g) satirlar.push(`Genel: ${g}`)
  for (const s of sofralar) if (s.notes?.trim()) satirlar.push(`${s.name}: ${s.notes.trim()}`)
  return satirlar.join('\n')
}
