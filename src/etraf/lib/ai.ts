// YAPAY ZEKA HYPE YORUMU (istege bagli): Claude, web aramasi aracini kullanip
// mekan hakkinda sosyal medyada / sozlukte / bloglarda / haberlerde ne
// konusuldugunu tarar ve kisa bir hype degerlendirmesi yazar.
// Tarayicidan dogrudan cagrilir; kullanici kendi Anthropic API anahtarini
// Ayarlar'a girer. SDK yalnizca cagri aninda (dinamik import) yuklenir.
import type Anthropic from '@anthropic-ai/sdk'
import { CATEGORY_BY_ID } from './categories'
import { sameish } from './scan'
import type { Place } from './types'

export const AI_MODEL = 'claude-opus-5-5'
// Bir istek guvenlik nedeniyle reddedilirse sunucu ayni istegi bu modelle
// yeniden dener (ayni cagri icinde).
const FALLBACK_MODEL = 'claude-opus-4-8'
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

export async function analyzeHype(apiKey: string, place: Place): Promise<HypeAnalysis> {
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
          model: AI_MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-06-01'],
          fallbacks: [{ model: FALLBACK_MODEL }],
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

// Ayarlar'daki "Anahtarı dene": aramasiz, cok kucuk bir istek.
export async function testClaudeKey(apiKey: string): Promise<string> {
  try {
    const mod = await import('@anthropic-ai/sdk')
    const client = new mod.default({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })
    await client.messages.create({
      model: AI_MODEL,
      max_tokens: 200,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Sadece "tamam" yaz.' }]
    })
    return 'Çalışıyor ✓'
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
