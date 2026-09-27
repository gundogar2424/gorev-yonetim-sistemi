// YAPAY ZEKA ILE TARIF AYIKLAMA (istege bagli).
//
// Sosyal medya aciklamalari daginik olur (emoji, hashtag, "tarif yorumlarda"...).
// API anahtari girildiyse metin Claude'a gonderilir ve duzenli bir tarif
// (baslik, malzemeler, adimlar, sure, porsiyon, etiketler) olarak geri alinir.
// Anahtar YALNIZCA bu cihazda (localStorage) saklanir, yedege yazilmaz.
import type { LzDraft } from '../types'

const KEY_ANAHTAR = 'lz-api-key'
const KEY_MODEL = 'lz-model'
export const VARSAYILAN_MODEL = 'claude-sonnet-5'

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

export function apiAnahtari(): string {
  try {
    return localStorage.getItem(KEY_ANAHTAR) ?? ''
  } catch {
    return ''
  }
}
export function apiAnahtariKaydet(v: string): void {
  try {
    if (v.trim()) localStorage.setItem(KEY_ANAHTAR, v.trim())
    else localStorage.removeItem(KEY_ANAHTAR)
  } catch {
    /* yok say */
  }
}
export function modelAdi(): string {
  try {
    return localStorage.getItem(KEY_MODEL) || VARSAYILAN_MODEL
  } catch {
    return VARSAYILAN_MODEL
  }
}
export function modelKaydet(v: string): void {
  try {
    if (v.trim() && v.trim() !== VARSAYILAN_MODEL) localStorage.setItem(KEY_MODEL, v.trim())
    else localStorage.removeItem(KEY_MODEL)
  } catch {
    /* yok say */
  }
}

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

async function istek(body: Record<string, unknown>): Promise<Response> {
  const anahtar = apiAnahtari()
  if (!anahtar) throw new Error('Yapay zeka için Ayarlar’dan API anahtarı gir.')
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anahtar,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  })
}

function hataMetni(status: number, govde: string): string {
  if (status === 401) return 'API anahtarı reddedildi. Ayarlar’dan kontrol et.'
  if (status === 403) return 'Anahtarın bu modele erişimi yok ya da bakiye yetersiz.'
  if (status === 404) return `Model bulunamadı (${modelAdi()}). Ayarlar’dan modeli değiştir.`
  if (status === 429) return 'Şu an istek sınırındasın; birazdan tekrar dene.'
  if (status === 529 || status >= 500) return 'Yapay zeka servisi şu an yoğun; birazdan tekrar dene.'
  return `İstek reddedildi (${status}). ${govde.slice(0, 160)}`
}

// Yapilandirilmis (json_schema) cagri: yanit dogrudan JSON olarak cozulur.
async function jsonCagri<T>(system: string, content: unknown, schema: object, maxTokens = 4000): Promise<T> {
  let r: Response
  try {
    r = await istek({
      model: modelAdi(),
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content }]
    })
  } catch (e) {
    if ((e as Error).message?.includes('API anahtarı')) throw e
    throw new Error('Yapay zekaya bağlanılamadı. İnternet bağlantını kontrol et.')
  }
  const govde = await r.text()
  if (!r.ok) throw new Error(hataMetni(r.status, govde))
  let json: { content?: { type: string; text?: string }[]; stop_reason?: string }
  try {
    json = JSON.parse(govde)
  } catch {
    throw new Error('Yapay zekadan anlaşılmayan bir yanıt geldi.')
  }
  const text = json.content?.find((c) => c.type === 'text')?.text ?? ''
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(json.stop_reason === 'max_tokens' ? 'Yanıt çok uzun, yarıda kesildi.' : 'Yapay zeka yanıtı okunamadı.')
  }
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
  'yemek tarifini çıkarıp düzenli Türkçe tarif olarak döndürürsün. İçerikte olmayan malzeme UYDURMA; ' +
  'miktar yazmıyorsa yalnızca malzeme adını yaz. Emoji, hashtag, "kaydet/beğen/takip et" gibi ' +
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
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
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
}
export async function aiVideodan(p: VideoParcalari): Promise<Partial<LzDraft>> {
  const icerik: unknown[] = []
  for (const k of p.kareler.slice(0, 10)) {
    const m = k.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
    if (m) icerik.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
  }
  const bolumler = [
    p.baslik && `Paylaşım başlığı: ${p.baslik}`,
    p.aciklama && `Paylaşımın açıklaması:\n"""\n${p.aciklama.slice(0, 8000)}\n"""`,
    p.altyazi && `Videonun altyazısı:\n"""\n${p.altyazi.slice(0, 15000)}\n"""`,
    p.konusma && `Videoda söylenenler (otomatik yazıya çevrildi, hatalı kelimeler olabilir):\n"""\n${p.konusma.slice(0, 15000)}\n"""`,
    p.kareler.length && `Yukarıdaki ${Math.min(10, p.kareler.length)} görsel videodan eşit aralıklarla alınmış karelerdir; ekrandaki yazılar (malzeme listesi, ölçüler) ve görünen malzemeler için bunlara bak.`
  ].filter(Boolean)
  icerik.push({
    type: 'text',
    text:
      bolumler.join('\n\n') +
      '\n\nBu kaynakları birleştirerek videodaki tarifi çıkar. Kaynaklar çelişirse videoda söylenen/yazan miktarı esas al. ' +
      'Otomatik yazıya çevirideki bozuk kelimeleri yemek bağlamına göre düzelt (ör. "su bar dağı" → "su bardağı").'
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
    const r = await istek({
      model: modelAdi(),
      max_tokens: 1,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: 'ping' }]
    })
    if (r.ok) return `✓ Anahtar çalışıyor (${modelAdi()}).`
    return '✗ ' + hataMetni(r.status, await r.text())
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
