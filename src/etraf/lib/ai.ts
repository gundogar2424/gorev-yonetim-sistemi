// YAPAY ZEKA HYPE YORUMU (istege bagli): yapay zeka web'de arama yapip
// mekan hakkinda sosyal medyada / sozlukte / bloglarda / haberlerde ne
// konusuldugunu tarar ve kisa bir hype degerlendirmesi yazar.
// Iki servis: Google Gemini (Google Arama ile; ucretsiz kotasi var, varsayilan)
// ya da Anthropic Claude (web aramasi araci ile; ucretli). Tarayicidan
// dogrudan cagrilir; kullanici kendi anahtarini Ayarlar'a girer. Claude SDK'si
// yalnizca cagri aninda (dinamik import) yuklenir.
import type Anthropic from '@anthropic-ai/sdk'
import { CATEGORY_BY_ID } from './categories'
import { HttpError, httpJson } from './http'
import { sameish } from './scan'
import type { Place } from './types'

// Uc secenek. Gemini: "gemini-flash-latest" takma adi her zaman en yeni Flash
// modeline gider (Google model adini degistirse de bozulmaz). Claude: en iyi
// sonuc icin Opus 5.5, yarisi fiyatina Sonnet 5.5.
export type AiModel = 'gemini-flash-latest' | 'claude-opus-5-5' | 'claude-sonnet-5-5'
export type AiProvider = 'gemini' | 'claude'
export const DEFAULT_AI_MODEL: AiModel = 'gemini-flash-latest'

export const AI_MODELS: { id: AiModel; provider: AiProvider; label: string; note: string; cost: string }[] = [
  {
    id: 'gemini-flash-latest',
    provider: 'gemini',
    label: 'Gemini',
    note: 'Google Gemini Flash',
    cost: 'ücretsiz kotada (günde yaklaşık 500 arama) ücretsiz'
  },
  {
    id: 'claude-opus-5-5',
    provider: 'claude',
    label: 'Claude Opus',
    note: 'Claude Opus 5.5',
    cost: 'yaklaşık 0,10-0,30 $'
  },
  {
    id: 'claude-sonnet-5-5',
    provider: 'claude',
    label: 'Claude Sonnet',
    note: 'Claude Sonnet 5.5',
    cost: 'yaklaşık 0,06-0,15 $'
  }
]

export function providerOf(model: AiModel): AiProvider {
  return model.startsWith('gemini') ? 'gemini' : 'claude'
}

export function aiModelInfo(id: string) {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0]
}

// Yaniti gercekte hangi model verdi? (Guvenlik reddinde yedek model
// calismis olabilir, ornegin claude-opus-4-8.)
export function modelName(id: string): string {
  const known = AI_MODELS.find((m) => m.id === id)?.note
  if (known) return known
  // Gemini gercek surum adini dondurur: "gemini-3.5-flash" -> "Gemini 3.5 Flash"
  if (id.startsWith('gemini-'))
    return id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  return id
}

// GUVENLIK REDDINDE YEDEK: sunucu ayni istegi ayni cagri icinde baska bir
// modelle yeniden dener. Opus 5.5 icin hedefi biz seciyoruz (dizi bicimi);
// Sonnet 5.5 yalnizca "default" bicimini kabul eder (hedefi Anthropic secer).
// Iki bicimin beta basliklari farklidir; karistirilirsa istek 400 doner.
// SDK 0.106'nin tipleri "default" degerini henuz tanimiyor, o yuzden tek
// yerde tip donusumu var.
function fallbackParams(model: AiModel): {
  betas: string[]
  fallbacks: Anthropic.Beta.Messages.BetaFallbackParam[]
} {
  if (model === 'claude-sonnet-5-5') {
    return {
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as unknown as Anthropic.Beta.Messages.BetaFallbackParam[]
    }
  }
  return { betas: ['server-side-fallback-2026-06-01'], fallbacks: [{ model: 'claude-opus-4-8' }] }
}
const MAX_SEARCHES = 5
const CACHE_DAYS = 7
const CACHE_MAX = 80

export type Trend = 'yukseliste' | 'sabit' | 'dususte' | 'bilinmiyor'

export interface HypeAnalysis {
  score: number // 0-100
  label: string // "Çok konuşuluyor", "Sakin bir mahalle mekânı"...
  trend: Trend
  summary: string // 2-4 cumle
  praised: string[] // ovulenler
  complaints: string[] // sikayetler
  platforms: string[] // nerede konusuluyor: Instagram, TikTok, Ekşi Sözlük...
  sources: { title: string; url: string }[]
  // Gemini + Google Arama: Google'in kosullari geregi gosterilmesi gereken
  // "Google'da ara" onerileri (Google'in hazirladigi HTML).
  searchSuggestionsHtml?: string
  at: number
  model: string
}

const SYSTEM = `Sen Türkiye'deki mekânların sosyal medyadaki "hype"ını (ne kadar konuşulduğunu, popülerlik ivmesini) değerlendiren bir araştırmacısın.

Görevin: Verilen mekân hakkında web araması yap ve insanların onun hakkında ne konuştuğunu bul. Şunlara bak: Instagram ve TikTok paylaşımları/videoları, X (Twitter), Ekşi Sözlük başlıkları, YouTube vlogları, yemek/gezi blogları, haber ve dergi listeleri ("en iyi ... listesi"), Google/TripAdvisor yorum özetleri. Son 12 aya ağırlık ver. Aynı adlı başka şehirdeki mekânla karıştırma; verilen konumu ve adresi esas al.

Dürüst ol: Hakkında az şey bulduysan bunu açıkça söyle ve puanı düşük ver. Uydurma paylaşım, sayı ya da alıntı yazma; yalnızca aramalarda gerçekten gördüğüne dayan.

Puan ölçeği (score, 0-100):
- 85-100: Viral / herkesin konuştuğu, listelerde, sık video çekilen yer
- 65-84: Çok konuşulan, düzenli paylaşılan
- 40-64: Bilinen, ara sıra bahsedilen
- 15-39: Az konuşulan, sadece yerel çevrede bilinen
- 0-14: Hakkında neredeyse hiç içerik yok

Araştırma bitince yanıtının SONUNA yalnızca şu biçimde bir JSON bloğu yaz (Türkçe):
\`\`\`json
{
  "score": 0-100 arası tam sayı,
  "label": "kısa etiket, en fazla 4 kelime",
  "trend": "yukseliste" | "sabit" | "dususte" | "bilinmiyor",
  "summary": "2-4 cümlelik özet: ne kadar ve neden konuşuluyor",
  "praised": ["en çok övülen 1-4 şey"],
  "complaints": ["en sık şikâyet edilen 0-3 şey"],
  "platforms": ["en çok konuşulduğu platformlar, örn. Instagram, TikTok, Ekşi Sözlük"]
}
\`\`\``

function describe(p: Place): string {
  const lines = [
    `Mekân: ${p.name}`,
    `Tür: ${p.subtype} (${CATEGORY_BY_ID[p.category].label})`,
    p.address ? `Adres: ${p.address}` : null,
    `Konum: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
    p.rating != null ? `Google puanı: ${p.rating} (${p.ratingCount ?? '?'} yorum)` : null,
    p.instagram ? `Instagram: ${p.instagram}` : null,
    p.website ? `Web: ${p.website}` : null
  ]
  return lines.filter(Boolean).join('\n')
}

// Son metin blogundaki ```json ... ``` (ya da son {...}) kismini cikar.
function parseVerdict(text: string): Omit<HypeAnalysis, 'sources' | 'at' | 'model'> {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].pop()?.[1]
  const raw = fenced ?? text.slice(text.lastIndexOf('{'), text.lastIndexOf('}') + 1)
  let j: Record<string, unknown>
  try {
    j = JSON.parse(raw)
  } catch {
    throw new Error('Yapay zekâ yanıtı okunamadı. Tekrar deneyin.')
  }
  const strs = (v: unknown, n: number) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, n) : []
  const trend = ['yukseliste', 'sabit', 'dususte', 'bilinmiyor'].includes(j.trend as string)
    ? (j.trend as Trend)
    : 'bilinmiyor'
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(j.score) || 0))),
    label: typeof j.label === 'string' ? j.label.slice(0, 40) : '',
    trend,
    summary: typeof j.summary === 'string' ? j.summary : '',
    praised: strs(j.praised, 4),
    complaints: strs(j.complaints, 3),
    platforms: strs(j.platforms, 5)
  }
}

// Kaynaklar modelin metninden degil, web aramasi sonuclarindan alinir
// (uydurma baglanti olmasin). Ayni siteden en fazla bir tane.
function collectSources(content: Anthropic.Beta.BetaContentBlock[]): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = []
  const hosts = new Set<string>()
  for (const b of content) {
    if (b.type !== 'web_search_tool_result' || !Array.isArray(b.content)) continue
    for (const r of b.content) {
      let host = ''
      try {
        host = new URL(r.url).hostname.replace(/^www\./, '')
      } catch {
        continue
      }
      if (hosts.has(host)) continue
      hosts.add(host)
      out.push({ title: r.title || host, url: r.url })
    }
  }
  return out.slice(0, 6)
}

function searchError(content: Anthropic.Beta.BetaContentBlock[]): string | null {
  for (const b of content) {
    if (b.type === 'web_search_tool_result' && !Array.isArray(b.content)) {
      return (b.content as { error_code?: string }).error_code ?? 'bilinmeyen'
    }
  }
  return null
}

export async function analyzeHype(
  apiKey: string,
  place: Place,
  model: AiModel = DEFAULT_AI_MODEL
): Promise<HypeAnalysis> {
  if (providerOf(model) === 'gemini') return analyzeHypeGemini(apiKey, place)
  return analyzeHypeClaude(apiKey, place, model)
}

async function analyzeHypeClaude(apiKey: string, place: Place, model: AiModel): Promise<HypeAnalysis> {
  if (!apiKey.trim()) throw new Error("Önce Ayarlar'dan Anthropic (Claude) API anahtarını girin.")
  const mod = await import('@anthropic-ai/sdk')
  const AnthropicSDK = mod.default
  const client = new AnthropicSDK({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Bu mekânın sosyal medya hype'ını değerlendir:\n\n${describe(place)}` }
  ]
  const all: Anthropic.Beta.BetaContentBlock[] = []
  let final: Anthropic.Beta.BetaMessage | null = null

  try {
    // Web aramasi uzun surerse sunucu turu "pause_turn" ile duraklatir;
    // cevabi geri ekleyip devam ettiriyoruz (en fazla 3 kez).
    for (let i = 0; i < 4; i++) {
      final = await client.beta.messages
        .stream({
          model,
          max_tokens: 16000,
          ...fallbackParams(model),
          // Iki modelde de "medium": cok adimli arama isi icin yeterli derinlik.
          // (Opus 5.5'te varsayilan zaten medium; Sonnet 5.5'te high.)
          output_config: { effort: 'medium' },
          system: SYSTEM,
          tools: [
            {
              type: 'web_search_20260209',
              name: 'web_search',
              max_uses: MAX_SEARCHES,
              user_location: { type: 'approximate', country: 'TR', timezone: 'Europe/Istanbul' }
            }
          ],
          messages
        })
        .finalMessage()
      all.push(...final.content)
      if (final.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: final.content })
    }
  } catch (e) {
    if (e instanceof AnthropicSDK.AuthenticationError) throw new Error('Anthropic API anahtarı geçersiz.')
    if (e instanceof AnthropicSDK.PermissionDeniedError)
      throw new Error('Bu anahtarın yetkisi yok (web araması Console’da kapalı olabilir).')
    if (e instanceof AnthropicSDK.RateLimitError)
      throw new Error('Çok sık istek gönderildi; biraz sonra tekrar deneyin.')
    if (e instanceof AnthropicSDK.BadRequestError) throw new Error('İstek reddedildi: ' + e.message)
    if (e instanceof AnthropicSDK.APIConnectionError)
      throw new Error('Claude sunucusuna bağlanılamadı. İnternet bağlantısını kontrol edin.')
    if (e instanceof AnthropicSDK.APIError) throw new Error(`Claude hatası (${e.status ?? '?'}): ${e.message}`)
    throw e
  }

  if (!final) throw new Error('Yapay zekâdan yanıt alınamadı.')
  if (final.stop_reason === 'refusal') throw new Error('Yapay zekâ bu isteği yanıtlamadı.')
  const errCode = searchError(all)
  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  if (!text.includes('{')) {
    if (errCode) throw new Error(`Web araması çalışmadı (${errCode}).`)
    throw new Error('Yapay zekâ bir değerlendirme yazmadı. Tekrar deneyin.')
  }
  return { ...parseVerdict(text), sources: collectSources(all), at: Date.now(), model: final.model }
}

// ---------------------------------------------------------------------------
// GEMINI (Google Arama ile "grounding"). REST API, duz fetch.
const GEMINI_ROOT = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest'
// Takma ad bu anahtarla bulunamazsa (404) kendiliginden secilen model burada saklanir.
const K_GEMINI_MODEL = 'et-gemini-model'

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] }
    finishReason?: string
    groundingMetadata?: {
      webSearchQueries?: string[]
      groundingChunks?: { web?: { uri?: string; title?: string } }[]
      searchEntryPoint?: { renderedContent?: string }
    }
  }[]
  promptFeedback?: { blockReason?: string }
  modelVersion?: string
}

function geminiError(e: unknown): Error {
  if (e instanceof HttpError) {
    const msg = e.message
    if (/API key not valid|API_KEY_INVALID/i.test(msg) || e.status === 401)
      return new Error('Gemini API anahtarı geçersiz.')
    if (e.status === 403) return new Error('Bu Gemini anahtarının yetkisi yok: ' + msg)
    if (e.status === 429)
      return new Error(
        'Gemini ücretsiz kotası doldu ya da çok sık istek gönderildi. Biraz sonra (ya da yarın) tekrar deneyin.'
      )
    if (e.status >= 500) return new Error('Gemini şu an yanıt veremiyor; biraz sonra tekrar deneyin.')
    return new Error(`Gemini hatası (${e.status}): ${msg}`)
  }
  if (e instanceof TypeError) return new Error('Gemini sunucusuna bağlanılamadı. İnternet bağlantısını kontrol edin.')
  return e instanceof Error ? e : new Error(String(e))
}

// Anahtar reddi mi? (Lezzet Defteri'nde gorulen: Google'in yeni "AQ." bicimli
// anahtarlari bazen x-goog-api-key basligiyla reddedilir ama adresin sonunda
// ?key= olarak kabul edilir; eski "AIza" anahtarlari basliklik calisir.)
function isKeyRejection(e: unknown): boolean {
  return (
    e instanceof HttpError &&
    [400, 401, 403].includes(e.status) &&
    /API key|API_KEY|UNAUTHENTICATED|PERMISSION_DENIED|credential/i.test(e.message)
  )
}

async function geminiRequest<T>(apiKey: string, path: string, body: unknown | null, timeoutMs: number): Promise<T> {
  const key = apiKey.trim()
  const url = `${GEMINI_ROOT}/${path}`
  const send = (viaQuery: boolean) =>
    httpJson<T>({
      url: viaQuery ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}` : url,
      method: body === null ? 'GET' : 'POST',
      headers: {
        ...(body === null ? {} : { 'Content-Type': 'application/json' }),
        ...(viaQuery ? {} : { 'x-goog-api-key': key })
      },
      body: body === null ? undefined : JSON.stringify(body),
      timeoutMs
    })
  try {
    return await send(false)
  } catch (e) {
    if (!isKeyRejection(e)) throw e
    try {
      return await send(true)
    } catch (e2) {
      throw isKeyRejection(e2) ? e : e2 // ikisi de reddettiyse ilk hatayi goster
    }
  }
}

// Takma ad bu anahtarla yoksa: anahtarin erisebildigi en yeni "flash" modeli.
async function findGeminiFlash(apiKey: string): Promise<string | null> {
  try {
    const j = await geminiRequest<{ models?: { name: string; supportedGenerationMethods?: string[] }[] }>(
      apiKey,
      'models?pageSize=200',
      null,
      20000
    )
    const names = (j.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => /flash/.test(n) && !/lite|image|tts|audio|live|embedding|exp/.test(n))
    const ver = (n: string) => Number(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0)
    names.sort((a, b) => ver(b) - ver(a) || Number(/preview/.test(a)) - Number(/preview/.test(b)))
    return names[0] ?? null
  } catch {
    return null
  }
}

// generateContent: model bulunamazsa (404) en yeni Flash'a gecer ve hatirlar;
// Google "yogun" derse (500/503) 2 sn bekleyip bir kez daha dener.
async function geminiGenerate(apiKey: string, body: unknown, timeoutMs: number): Promise<GeminiResponse> {
  let model = GEMINI_DEFAULT_MODEL
  try {
    model = localStorage.getItem(K_GEMINI_MODEL) || GEMINI_DEFAULT_MODEL
  } catch {
    /* yok say */
  }
  const call = (m: string) =>
    geminiRequest<GeminiResponse>(apiKey, `models/${encodeURIComponent(m)}:generateContent`, body, timeoutMs)
  try {
    return await call(model)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      const alt = await findGeminiFlash(apiKey)
      if (alt && alt !== model) {
        const res = await call(alt)
        try {
          localStorage.setItem(K_GEMINI_MODEL, alt)
        } catch {
          /* yok say */
        }
        return res
      }
    }
    if (e instanceof HttpError && (e.status === 500 || e.status === 503)) {
      await new Promise((r) => setTimeout(r, 2000))
      return await call(model)
    }
    throw e
  }
}

async function analyzeHypeGemini(apiKey: string, place: Place): Promise<HypeAnalysis> {
  if (!apiKey.trim()) throw new Error("Önce Ayarlar'dan Gemini API anahtarını girin.")
  let res: GeminiResponse
  try {
    res = await geminiGenerate(
      apiKey,
      {
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [
          { role: 'user', parts: [{ text: `Bu mekânın sosyal medya hype'ını değerlendir:\n\n${describe(place)}` }] }
        ],
        tools: [{ google_search: {} }]
      },
      120000
    )
  } catch (e) {
    throw geminiError(e)
  }

  if (res.promptFeedback?.blockReason) throw new Error('Yapay zekâ bu isteği yanıtlamadı.')
  const c = res.candidates?.[0]
  const text = (c?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
  if (!text.includes('{')) {
    if (c?.finishReason && c.finishReason !== 'STOP')
      throw new Error(`Yapay zekâ yanıtı tamamlanamadı (${c.finishReason}).`)
    throw new Error('Yapay zekâ bir değerlendirme yazmadı. Tekrar deneyin.')
  }

  // Kaynaklar Google Arama sonuclarindan (baslik = site adi); site basina bir tane.
  const gm = c?.groundingMetadata
  const sources: { title: string; url: string }[] = []
  const seen = new Set<string>()
  for (const ch of gm?.groundingChunks ?? []) {
    const url = ch.web?.uri
    const title = ch.web?.title || ''
    if (!url || seen.has(title || url)) continue
    seen.add(title || url)
    sources.push({ title: title || url, url })
  }

  return {
    ...parseVerdict(text),
    sources: sources.slice(0, 6),
    searchSuggestionsHtml: gm?.searchEntryPoint?.renderedContent || undefined,
    at: Date.now(),
    model: res.modelVersion || GEMINI_DEFAULT_MODEL
  }
}

// Ayarlar'daki "Anahtarı dene": aramasiz, cok kucuk bir istek.
export async function testAiKey(apiKey: string, model: AiModel = DEFAULT_AI_MODEL): Promise<string> {
  if (providerOf(model) === 'gemini') {
    try {
      const res = await geminiGenerate(
        apiKey,
        { contents: [{ role: 'user', parts: [{ text: 'Sadece "tamam" yaz.' }] }] },
        30000
      )
      return `Çalışıyor ✓ (${modelName(res.modelVersion || GEMINI_DEFAULT_MODEL)})`
    } catch (e) {
      return 'Hata: ' + geminiError(e).message
    }
  }
  return testClaudeKey(apiKey, model)
}

async function testClaudeKey(apiKey: string, model: AiModel): Promise<string> {
  try {
    const mod = await import('@anthropic-ai/sdk')
    const client = new mod.default({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })
    await client.messages.create({
      model,
      max_tokens: 200,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Sadece "tamam" yaz.' }]
    })
    return `Çalışıyor ✓ (${aiModelInfo(model).note})`
  } catch (e) {
    return 'Hata: ' + (e instanceof Error ? e.message : String(e))
  }
}

// ÖNBELLEK: ayni mekan 7 gun icinde yeniden sorulmaz (para ve zaman).
// Kimlik yerine ad + konumla eslenir (Google/OSM kimligi farkli olabilir).
const K_AI = 'et-ai-hype'

interface CacheEntry {
  name: string
  lat: number
  lng: number
  id: string
  analysis: HypeAnalysis
}

function readCache(): CacheEntry[] {
  try {
    const raw = localStorage.getItem(K_AI)
    const list = raw ? (JSON.parse(raw) as CacheEntry[]) : []
    const cutoff = Date.now() - CACHE_DAYS * 864e5
    return list.filter((e) => e.analysis.at >= cutoff)
  } catch {
    return []
  }
}

function asPlaceLike(e: CacheEntry): Place {
  return { id: e.id, name: e.name, lat: e.lat, lng: e.lng } as Place
}

export function getCachedHype(p: Place, cache: CacheEntry[] = readCache()): HypeAnalysis | null {
  const e = cache.find((c) => c.id === p.id || sameish(asPlaceLike(c), p))
  return e?.analysis ?? null
}

export function saveCachedHype(p: Place, analysis: HypeAnalysis): void {
  const list = readCache().filter((c) => !(c.id === p.id || sameish(asPlaceLike(c), p)))
  list.unshift({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, analysis })
  try {
    localStorage.setItem(K_AI, JSON.stringify(list.slice(0, CACHE_MAX)))
  } catch {
    /* kota dolu olabilir */
  }
}

export function getAllCachedHype(): CacheEntry[] {
  return readCache()
}

export const TREND_TEXT: Record<Trend, string> = {
  yukseliste: '📈 Yükselişte',
  sabit: '➡️ Sabit',
  dususte: '📉 Düşüşte',
  bilinmiyor: '❔ Eğilim belirsiz'
}
